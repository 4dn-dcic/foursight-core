import os

import redis.exceptions
from foursight_core.s3_connection import S3Connection
from foursight_core.es_connection import ESConnection
from dcicutils.misc_utils import PRINT
from dcicutils.s3_utils import s3Utils
from dcicutils.env_utils import full_env_name, is_stg_or_prd_env
from dcicutils.redis_utils import create_redis_client
from dcicutils.redis_tools import RedisBase, RedisSessionToken


class FSConnection(object):
    """
    Contains the foursight (FS) and fourfront (FF) connections needed to
    communicate with both services. Contains fields that link to the FF keys,
    and s3 connection, as well as the FS s3_connection. They are:
    - fs_env: string FS environment (such as 'data' or 'webdev')
    - ff_server: string server name of the linked FF
    - ff_env: string EB enviroment name of FF (such as 'fourfront-webprod').
              This is kept up-to-date for data and staging
              (COMPATIBILITY NOTE: This argument is mis-named.
               It isn't really an ff_env but rather an s3 bucket key,
               so 'fourfront-webprod' still names the bucket used
               by environment 'fourfront-blue' and 'fourfront-green'.)
    - ff_s3: s3Utils connection to the FF environment (see dcicutils.s3_utils)
    - ff_keys: FF keys for the environment with 'key', 'secret' and 'server'
    - ff_es: string server of the elasticsearch for the FF
    - s3_connection: S3Connection object that is the s3 connection for FS

    If param test=True, then do not actually attempt to initate the FF connections
    """
    def __init__(self, fs_environ, fs_environ_info, test=False, use_es=True, host=None):
        # FOURSIGHT information
        # With the new EnvUtils, FS schedules conform to the full env name,
        # so expand to full_env_name if we are rendering a (legacy) short name
        # ie: webdev --> fourfront-webdev - Will July 22 2022
        self.fs_env = full_env_name(fs_environ) if not is_stg_or_prd_env(fs_environ) else fs_environ
        es = ESConnection(index=fs_environ_info.get('bucket'), host=host) if use_es else None
        self.connections = {
            's3': S3Connection(fs_environ_info.get('bucket')),
            'es': es
        }
        # FOURFRONT information
        self.ff_server = fs_environ_info['fourfront']
        self.ff_env = fs_environ_info['ff_env']
        self.ff_es = fs_environ_info['es'] if not host else host
        self.ff_bucket = fs_environ_info['bucket']
        self.redis = None
        self.redis_url = None
        try:
            if 'redis' in fs_environ_info:
                self.redis_url = fs_environ_info['redis']
            elif 'REDIS_HOST' in os.environ:  # temporary patch in until env config is fully sorted - Will
                self.redis_url = os.environ['REDIS_HOST']
            if self.redis_url and ("redis://" in self.redis_url or "rediss://" in self.redis_url):
                self.redis = RedisBase(create_redis_client(url=self.redis_url))
            else:
                PRINT("Redis URL was not specified in any way so running without Redis.")
        except redis.exceptions.ConnectionError as e:
            PRINT(f"Error {str(e)} \n"
                  f"Cannot connect to Redis ({self.redis_url}); but can run without it so continuing.")
            self.redis = None
            self.redis_url = None
        if self.redis:
            PRINT(f"Redis server is being used: {self.redis_url}")
        else:
            PRINT(f"Redis server is not being used.")
        if not test:
            self.ff_s3 = s3Utils(env=self.ff_env)
            try:  # TODO: make this configurable from env variables?
                self.ff_keys = self.ff_s3.get_access_keys('access_key_foursight')
            except Exception as e:
                raise Exception('Could not initiate connection to Fourfront; it is probably a bad ff_env. '
                      'You gave: %s. Error message: %s' % (self.ff_env, str(e)))
            # ensure ff_keys has server, and make sure it does not end with '/'
            if 'server' not in self.ff_keys:
                server = self.ff_server[:-1] if self.ff_server.endswith('/') else self.ff_server
                self.ff_keys['server'] = server
        else:
            self.ff_s3 = None
            self.ff_keys = None

    def get_object(self, key):
        """
        Queries ES for key - checks S3 if it doesn't find it
        """
        obj = None
        if self.connections['es'] is not None:
            obj = self.connections['es'].get_object(key)
        if obj is None:
            obj = self.connections['s3'].get_object(key)
        return obj

    def put_object(self, key, value):
        """
        Puts an object onto both ES and S3
        """
        for conn in self.connections.values():
            if conn is not None:
                conn.put_object(key, value)

    def test_es_connection(self):
        """ Pings ES to ensure we can connect to it, useful in some failure scenarios """
        if self.connections['es']:
            return self.connections['es'].test_connection()
        return False

    def es_info(self):
        """ Returns basic info about the Elasticsearch server. """
        if self.connections['es']:
            return self.connections['es'].info()

    def es_health(self):
        """ Returns basic health about the Elasticsearch server cluster. """
        if self.connections['es']:
            return self.connections['es'].health()

    def redis_info(self):
        """ Returns basic info about the Redis server """
        return self.redis.info() if self.redis else None

    def get_redis_base(self):
        """ Returns handle to FS Redis Base object """
        return self.redis
