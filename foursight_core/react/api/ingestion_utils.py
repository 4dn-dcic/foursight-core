import base64
import json
from typing import List, Optional, Tuple, Union
import uuid
from ...boto_s3 import boto_s3_client
from .datetime_utils import convert_utc_datetime_to_utc_datetime_string


def read_ingestion_submissions(bucket: str,
                               offset: int = 0, limit: int = -1,
                               sort: Optional[str] = None) -> dict:
    """
    Returns information about the ingestion submission keys within the metadata-bundles-bucket,
    This keys in this bucket are organized by ingestion submission uuid like this:

    -> 9f9e5033-a1bc-4e72-ad0d-1873d4253f25/started.txt
    -> 9f9e5033-a1bc-4e72-ad0d-1873d4253f25/submission.json

    So we return a list (actually a dictionary with the list together with paging info)
    of objects by uuid like this:

       {
           "uuid": 9f9e5033-a1bc-4e72-ad0d-1873d4253f25/started.txt
           "started": true
           "done": true
           "modified": "2023-09-15 13:45:20 UTC"
       }

    These are ordered, by default, by reverse modified datetime (most recent first).

    Some ingestion info can be gotten via Portal but only that which is written to the database,
    which does not include the details of the ingested submission, i.e. the actual list of uuids
    for objects which were created, update, or validated; nor does it include any details of any
    validation errors (or other errors or exceptions) which may have occurred.
    """
    s3 = boto_s3_client()

    def is_uuid(value: str) -> bool:
        try:
            return str(uuid.UUID(value)).lower() == value.lower()
        except Exception:
            return False

    def get_uuid_and_file_from_key(key: str) -> Tuple[Optional[str], Optional[str]]:
        parts = key.split("/")
        if len(parts) != 2 or not is_uuid(parts[0]) or not parts[1]:
            return (None, None)
        return (parts[0], parts[1])

    def add_key_to_keys(uuid: str, key: dict, keys: dict) -> None:
        existing_key = keys.get(uuid)
        if existing_key:
            # We take the most recently modified date within the
            # bucket amont the keys with the same (prefix) uuid.
            if key["modified"] > existing_key["modified"]:
                existing_key["modified"] = key["modified"]
            if key["started"]:
                existing_key["started"] = True
            if key["done"]:
                existing_key["done"] = True
            if key["error"]:
                existing_key["error"] = True
            if key["file"].startswith("datafile"):
                existing_key["file"] = key["datafile"]
            if key["file"] not in existing_key["files"]:
                existing_key["files"].append(key["file"])
        else:
            if key.get("files"):
                if key["file"] not in key["files"]:
                    key["files"].append(key["file"])
            else:
                key["files"] = [key["file"]]
            keys[uuid] = key

    # Unfortunately AWS/boto3 does not allow sorting, so we need to read all the keys in the bucket;
    # this may be slow, but it's quicker than manually rummaging around when you need to find something.

    def get_chunk_of_keys(bucket: str, next_token: Optional[str] = None) -> Tuple[Optional[List[dict]], Optional[str]]:
        keys = {}
        MAX_KEYS_PER_READ = 1000
        if next_token:
            response = s3.list_objects_v2(Bucket=bucket, MaxKeys=MAX_KEYS_PER_READ, ContinuationToken=next_token)
        else:
            response = s3.list_objects_v2(Bucket=bucket, MaxKeys=MAX_KEYS_PER_READ)
        for item in response.get("Contents", []):
            key = item["Key"]
            uuid, file = get_uuid_and_file_from_key(key)
            if not uuid or not file:
                continue
            key = {"uuid": uuid, "modified": item["LastModified"],
                   "file": file,
                   "started": file.endswith("started.txt"),
                   "done": file.endswith("submission.json") or file.endswith("submission.json.json"),
                   "error": file.endswith("traceback.txt")}
            add_key_to_keys(uuid, key, keys)
        return (keys, response.get("NextContinuationToken"))

    keys = {}
    next_token = None
    while True:
        chunk_of_keys, next_token = get_chunk_of_keys(bucket, next_token)
        if chunk_of_keys:
            [add_key_to_keys(uuid, chunk_of_keys[uuid], keys) for uuid in chunk_of_keys]
        if not next_token:
            break
    keys = [keys[uuid] for uuid in keys]
    total = len(keys)

    sort_key = None
    if sort:
        if sort.endswith(".desc"):
            sort_key = sort[:-5].lower()
            sort_reverse = True
        elif sort.endswith(".asc"):
            sort_key = sort[:-4].lower()
            sort_reverse = False
    if sort_key in ["uuid", "modified"]:
        keys = sorted(keys, key=lambda key: key[sort_key], reverse=sort_reverse)

    offset = (total if offset > total else offset) if offset >= 0 else 0
    limit = limit if limit >= 0 else total
    end_offset = offset + limit if offset + limit <= total else total
    keys = keys[offset:end_offset]

    for key in keys:
        key["modified"] = convert_utc_datetime_to_utc_datetime_string(key["modified"])

    return {
        "paging": {
            "total": total, "count": end_offset - offset,
            "limit": limit, "offset": offset,
            "more": max(total - offset - limit, 0)
        }, "list": keys}


def read_ingestion_submission_detail(bucket: str, uuid: str) -> Optional[str]:
    file = f"submission.json"
    contents = _read_s3_key(bucket, f"{uuid}/{file}", is_json=True)
    if not contents:
        file = f"submission.json.json"
        contents = _read_s3_key(bucket, f"{uuid}/{file}", is_json=True)
    return {"file": file, "detail": contents}


def read_ingestion_submission_summary(bucket: str, uuid: str) -> Optional[str]:
    file = f"summary.json"
    contents = _read_s3_key(bucket, f"{uuid}/{file}", is_json=True)
    return {"file": file, "summary": contents, "started": _exists_s3_key(bucket, file)}


def read_ingestion_submission_manifest(bucket: str, uuid: str) -> Optional[str]:
    file = f"manifest.json"
    return {"file": file, "manifest": _read_s3_key(bucket, f"{uuid}/{file}", is_json=True)}


def read_ingestion_submission_post_output(bucket: str, uuid: str) -> Optional[str]:
    file = f"post_output.json"
    return {"file": file, "post_output": _read_s3_key(bucket, f"{uuid}/{file}", is_json=True)}


def read_ingestion_submission_upload_info(bucket: str, uuid: str) -> Optional[dict]:
    file = f"upload_info.txt"
    return {"file": file, "upload_info": _read_s3_key(bucket, f"{uuid}/{file}", is_json=True)}


def read_ingestion_submission_resolution(bucket: str, uuid: str) -> Optional[str]:
    file = f"resolution.json"
    return {"file": file, "resolution": _read_s3_key(bucket, f"{uuid}/{file}", is_json=True)}


def read_ingestion_submission_submission_response(bucket: str, uuid: str) -> Optional[str]:
    file = f"submission_response.txt"
    return {"file": file, "submission_response": _read_s3_key(bucket, f"{uuid}/{file}", is_json=False)}


def read_ingestion_submission_traceback(bucket: str, uuid: str) -> Optional[str]:
    file = f"traceback.txt"
    return {"file": file, "traceback": _read_s3_key(bucket, f"{uuid}/{file}", is_json=False)}


def read_ingestion_submission_validation_report(bucket: str, uuid: str) -> Optional[str]:
    file = f"validation_report.txt"
    return {"file": file, "validation_report": _read_s3_key(bucket, f"{uuid}/{file}", is_json=False)}


def read_ingestion_submission_data_info(bucket: str, uuid: str) -> Optional[dict]:
    manifest = read_ingestion_submission_manifest(bucket, uuid)
    if manifest:
        data_key = manifest.get("manifest", {}).get("object_name")
        if data_key:
            data_file = data_key[len(f"{uuid}/"):] if data_key.startswith(f"{uuid}/") else data_key
            is_json = data_key.endswith(".json")
            is_binary = not is_json and not data_key.endswith(".txt")
            size = _sizeof_s3_key(bucket, data_key)
            return {"key": data_key, "file": data_file, "size": size, "type": "json" if is_json else ("binary" if is_binary else "text")}
    return None


def read_ingestion_submission_data(bucket: str, uuid: str) -> Optional[Union[dict, str, bytes]]:
    info = read_ingestion_submission_data_info(bucket, uuid)
    if info:
        key = info["key"]
        is_json = info["type"] == "json"
        is_binary = info["type"] == "binary"
        return _read_s3_key(bucket, key, is_json=is_json, is_binary=is_binary)


def _read_s3_key(bucket: str, key: str,
                 is_json: bool = False, is_binary: bool = False) -> Optional[Union[dict, str, bytes]]:
    if is_json:
        is_binary = False
    try:
        contents = boto_s3_client().get_object(Bucket=bucket, Key=key)["Body"].read()
        if not is_binary:
            contents = contents.decode("utf-8")
            if is_json:
                contents = json.loads(contents)
        else:
            contents = base64.b64encode(contents).decode("utf-8")
        return contents
    except Exception:
        return None


def _exists_s3_key(bucket: str, key: str) -> Optional[str]:
    try:
        return boto_s3_client().head_object(Bucket=bucket, Key=key) is not None
    except Exception:
        return False


def _sizeof_s3_key(bucket: str, key: str) -> Optional[int]:
    try:
        return boto_s3_client().head_object(Bucket=bucket, Key=key).get("ContentLength")
    except Exception:
        return None
