import boto3
from ...datetime_utils import convert_utc_datetime_to_useastern_datetime

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
                            "modified": convert_utc_datetime_to_useastern_datetime(bucket_key["LastModified"])
                        })

        except Exception as e:
            print("Get bucket keys error: " + str(e))
        return results

    @staticmethod
    def get_bucket_key_contents(bucket_name: str, bucket_key_name) -> list:
        try:
            s3 = boto3.resource("s3")
            s3_object = s3.Object(bucket_name, bucket_key_name)
            return s3_object.get()["Body"].read().decode("utf-8")
        except Exception as e:
            print("Get bucket key contents error: " + str(e))
