import boto3
import logging
from typing import Optional
from .datetime_utils import convert_utc_datetime_to_useastern_datetime_string

logging.basicConfig()
logger = logging.getLogger(__name__)


class AwsS3:

    @staticmethod
    def get_buckets() -> list:
        results = []
        try:
            s3 = boto3.resource("s3")
            results = sorted([bucket.name for bucket in s3.buckets.all()])
        except Exception as e:
            logger.error(f"Exception getting S3 bucket list: {e}")
        return results

    @staticmethod
    def get_bucket_keys(bucket_name: str) -> list:
        results = []
        try:
            s3 = boto3.client("s3")
            bucket_keys = s3.list_objects(Bucket=bucket_name)
            if bucket_keys:
                bucket_keys = bucket_keys.get("Contents")
                if bucket_keys:
                    for bucket_key in sorted(bucket_keys, key=lambda item: item["Key"]):
                        results.append({
                            "key": bucket_key["Key"],
                            "size": bucket_key["Size"],
                            "modified": convert_utc_datetime_to_useastern_datetime_string(bucket_key["LastModified"])
                        })

        except Exception as e:
            logger.error(f"Exception getting S3 bucket key list: {e}")
        return results

    SHOW_BUCKET_KEY_CONTENT_MAX_SIZE_BYTES = 50000

    @staticmethod
    def _may_look_at_key_content(bucket, key, size) -> bool:
        if size > AwsS3.SHOW_BUCKET_KEY_CONTENT_MAX_SIZE_BYTES:
            return False
        if key.endswith(".json"):
            return True
        if bucket.endswith("-envs"):
            return True
        return False

    @staticmethod
    def _get_bucket_key_content_size(bucket_name: str, bucket_key_name) -> int:
        try:
            s3 = boto3.client('s3')
            response = s3.head_object(Bucket=bucket_name, Key=bucket_key_name)
            size = response['ContentLength']
            return size
        except Exception as e:
            return -1

    @staticmethod
    def bucket_key_exists(bucket_name: str, bucket_key_name) -> bool:
        """
        Returns true iff the given S3 key in the given S3 bucket exists AND is not empty.
        """
        try:
            return AwsS3._get_bucket_key_content_size(bucket_name, bucket_key_name) > 0
        except Exception as e:
            return False

    @staticmethod
    def get_bucket_key_contents(bucket_name: str, bucket_key_name) -> Optional[list]:
        try:
            size = AwsS3._get_bucket_key_content_size(bucket_name, bucket_key_name)
            if size <= 0 or not AwsS3._may_look_at_key_content(bucket_name, bucket_key_name, size):
                return None
            s3 = boto3.resource("s3")
            s3_object = s3.Object(bucket_name, bucket_key_name)
            return s3_object.get()["Body"].read().decode("utf-8")
        except Exception as e:
            logger.error(f"Exception getting S3 key content: {e}")
