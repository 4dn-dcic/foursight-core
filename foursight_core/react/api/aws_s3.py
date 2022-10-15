import boto3
from .datetime_utils import convert_utc_datetime_to_useastern_datetime_string


class AwsS3:

    @staticmethod
    def get_buckets() -> list:
        results = []
        try:
            s3 = boto3.resource("s3")
            results = sorted([bucket.name for bucket in s3.buckets.all()])
        except Exception as e:
            print("Get buckets error: " + str(e))
            pass
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
            print("Get bucket keys error: " + str(e))
        return results

    SHOW_BUCKET_KEY_CONTENT_MAX_SIZE_BYTES = 50000

    @staticmethod
    def  may_look_at_key_content(bucket, key, size):
        if size > AwsS3.SHOW_BUCKET_KEY_CONTENT_MAX_SIZE_BYTES:
            return False;
        if key.endswith(".json"):
            return True;
        if bucket.endswith("-envs"):
            return True;
        return False;

    @staticmethod
    def get_bucket_key_content_size(bucket_name: str, bucket_key_name) -> list:
        try:
            s3 = boto3.client('s3')
            response = s3.head_object(Bucket=bucket_name, Key=bucket_key_name)
            size = response['ContentLength']
            return size
        except Exception as e:
            print(e)

    @staticmethod
    def get_bucket_key_contents(bucket_name: str, bucket_key_name) -> list:
        try:
            size = AwsS3.get_bucket_key_content_size(bucket_name, bucket_key_name)
            if not AwsS3.may_look_at_key_content(bucket_name, bucket_key_name, size):
                return None
            s3 = boto3.resource("s3")
            s3_object = s3.Object(bucket_name, bucket_key_name)
            return s3_object.get()["Body"].read().decode("utf-8")
        except Exception as e:
            print("Get bucket key contents error: " + str(e))
