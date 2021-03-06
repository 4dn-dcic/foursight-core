"""
Generate gitignored .chalice/config.json for deploy and then run deploy.
Takes on parameter for now: stage (either "dev" or "prod")
"""
import os
from os.path import dirname
import sys
import argparse
import json
import subprocess


class Deploy(object):
    
    CONFIG_BASE = {
      "stages": {
        "dev": {
          "api_gateway_stage": "api",
          "autogen_policy": False,
          "lambda_memory_size": 512,
          "lambda_timeout": 900,  # 15 mins in seconds
          "environment_variables": {
              "chalice_stage": "dev"
          }
        },
        "prod": {
          "api_gateway_stage": "api",
          "autogen_policy": False,
          "lambda_memory_size": 512,
          "lambda_timeout": 900,  # 15 mins in seconds
          "environment_variables": {
              "chalice_stage": "prod"
          }
        }
      },
      "version": "2.0",
      "app_name": "foursight-cgap",
      "layers": [  # required for Deployment Checks - Will 5/20/2020
          "arn:aws:lambda:us-east-1:553035198032:layer:git:11"
      ]
    }

    config_dir = dirname(__file__)

    @classmethod
    def get_config_filepath(cls):
        return os.path.join(cls.config_dir, '.chalice/config.json')
 
    @classmethod
    def build_config_and_deploy(cls, stage):
        # key to de-encrypt access key
        s3_enc_secret = os.environ.get("S3_ENCRYPT_KEY")
        client_id = os.environ.get("CLIENT_ID")
        client_secret = os.environ.get("CLIENT_SECRET")
        dev_secret = os.environ.get("DEV_SECRET")
        if not (s3_enc_secret and client_id and client_secret and dev_secret):
            print(''.join(['ERROR. You are missing one more more environment ',
                           'variables needed to deploy Foursight.\n',
                           'Need: S3_ENCRYPT_KEY, CLIENT_ID, CLIENT_SECRET, DEV_SECRET.'])
                  )
            sys.exit()
        for curr_stage in ['dev', 'prod']:
            cls.CONFIG_BASE['stages'][curr_stage]['environment_variables']['S3_ENCRYPT_KEY'] = s3_enc_secret
            cls.CONFIG_BASE['stages'][curr_stage]['environment_variables']['CLIENT_ID'] = client_id
            cls.CONFIG_BASE['stages'][curr_stage]['environment_variables']['CLIENT_SECRET'] = client_secret
            cls.CONFIG_BASE['stages'][curr_stage]['environment_variables']['DEV_SECRET'] = dev_secret
    
        filename = cls.get_config_filepath()
        print(''.join(['Writing: ', filename]))
        with open(filename, 'w') as config_file:
            config_file.write(json.dumps(cls.CONFIG_BASE))
        # export poetry into requirements
        subprocess.check_call(['poetry', 'export', '-f', 'requirements.txt', '--without-hashes', '-o', 'requirements.txt'])
        # actually deploy
        subprocess.call(['chalice', 'deploy', '--stage', stage])
    
    
def main():
    parser = argparse.ArgumentParser('chalice_deploy')
    parser.add_argument(
        "stage",
        type=str,
        choices=['dev', 'prod'],
        help="chalice deployment stage. Must be one of 'prod' or 'dev'")
    args = parser.parse_args()
    Deploy.build_config_and_deploy(args.stage)


if __name__ == '__main__':
    main()
