import json
from dcicutils.misc_utils import ignored
from .boto_s3 import boto_s3_client


class Buckets(object):
    """create and configure buckets for foursight"""

    prefix = 'placeholder_prefix'  # replace w/ e.g. 'foursight-cgap'
    envs = ['placeholder_env1', 'placeholder_env2']  # replace w/ e.g.  ['cgap', 'cgapdev', 'cgaptest', 'cgapwolf']
    default_acl = 'private'
    region = 'us-east-1'

    def __init__(self):
        pass

    @property
    def bucket_names(self):
        dev_suffices = ['dev-' + env for env in self.envs]
        prod_suffices = ['prod-' + env for env in self.envs]
        test_suffices = ['test-s3', 'unit-test-envs']
        suffices = dev_suffices + prod_suffices + test_suffices + ['runs', 'envs']
        return [self.prefix + '-' + suffix for suffix in suffices]

    @property
    def env_bucket(self):
        return self.prefix + '-envs'

    @classmethod
    def ff_env(cls, env):
        return 'fourfront-%s' % env  # TODO: Should we use dcicutils.env_utils.full_env_name?

    @classmethod
    def ff_url(cls, env):
        ignored(env)
        # replace this with the correct url in the child class
        # e.g. 'https://cgap.hms.harvard.edu/'
        return 'http://placeholder_url'

    @classmethod
    def es_url(cls, env):
        ignored(env)
        # replace this with the correct url in the child class
        # e.g. "https://search-cgap-testing-6-8-vo4mdkmkshvmyddc65ux7dtaou.us-east-1.es.amazonaws.com"
        return 'https://placeholder_url'

    def create_buckets(self):
        s3 = boto_s3_client()
        for bucket in self.bucket_names:
            param = {'Bucket': bucket, 'ACL': self.default_acl}
            if self.region != 'us-east-1':
                param.update({'CreateBucketConfiguration': {'LocationConstraint': self.region}})
            s3.create_bucket(**param)

    def configure_env_bucket(self):
        s3 = boto_s3_client()
        try:
            s3.head_bucket(self.env_bucket)  # check if bucket exists
        except Exception as e:
            if 'NoSuchBucket' in str(e):
                print("first create buckets! %s" % str(e))
        for env in self.envs:
            content = {"fourfront": self.ff_url(env),
                       "es": self.es_url(env),
                       "ff_env": self.ff_env(env)}
            body = json.dumps(content).encode('utf-8')
            s3.put_object(Bucket=self.env_bucket, Key=env, Body=body)


def main():
    buckets = Buckets()
    buckets.create_buckets()
    buckets.configure_env_bucket()


if __name__ == '__main__':
    main()
