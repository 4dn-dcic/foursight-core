import logging
from typing import Optional
from .datetime_utils import convert_datetime_to_utc_datetime_string
from ...boto_s3 import boto_s3_client, boto_s3_resource

logging.basicConfig()
logger = logging.getLogger(__name__)


class AwsS3:

    @classmethod
    def get_buckets(cls) -> list:
        results = []
        try:
            s3 = boto_s3_resource()
            results = sorted([bucket.name for bucket in s3.buckets.all()])
        except Exception as e:
            logger.error(f"Exception getting S3 bucket list: {e}")
        return results

    @classmethod
    def get_bucket_keys(cls, bucket_name: str) -> list:
        results = []
        try:
            s3 = boto_s3_client()
            bucket_keys = s3.list_objects(Bucket=bucket_name)
            if bucket_keys:
                bucket_keys = bucket_keys.get("Contents")
                if bucket_keys:
                    for bucket_key in sorted(bucket_keys, key=lambda item: item["Key"]):
                        results.append({
                            "key": bucket_key["Key"],
                            "size": bucket_key["Size"],
                            "modified": convert_datetime_to_utc_datetime_string(bucket_key["LastModified"])
                        })

        except Exception as e:
            logger.error(f"Exception getting S3 bucket key list: {e}")
        return results

    SHOW_BUCKET_KEY_CONTENT_MAX_SIZE_BYTES = 50000

    @classmethod
    def _may_look_at_key_content(cls, bucket, key, size) -> bool:
        if size > cls.SHOW_BUCKET_KEY_CONTENT_MAX_SIZE_BYTES:
            return False
        if key.endswith(".json"):
            return True
        if bucket.endswith("-envs"):
            return True
        return False

    @classmethod
    def _get_bucket_key_content_size(cls, bucket_name: str, bucket_key_name) -> int:
        try:
            s3 = boto_s3_client()
            response = s3.head_object(Bucket=bucket_name, Key=bucket_key_name)
            size = response['ContentLength']
            return size
        except Exception as e:
            return -1

    @classmethod
    def bucket_key_exists(cls, bucket_name: str, bucket_key_name) -> bool:
        """
        Returns true iff the given S3 key in the given S3 bucket exists AND is not empty.
        """
        try:
            return cls._get_bucket_key_content_size(bucket_name, bucket_key_name) > 0
        except Exception as e:
            return False

    @classmethod
    def get_bucket_key_contents(cls, bucket_name: str, bucket_key_name) -> Optional[list]:
        try:
            size = cls._get_bucket_key_content_size(bucket_name, bucket_key_name)
            if size <= 0 or not cls._may_look_at_key_content(bucket_name, bucket_key_name, size):
                return None
            s3 = boto_s3_resource()
            s3_object = s3.Object(bucket_name, bucket_key_name)
            return s3_object.get()["Body"].read().decode("utf-8")
        except Exception as e:
            logger.error(f"Exception getting S3 key content: {e}")
