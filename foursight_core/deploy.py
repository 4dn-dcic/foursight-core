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
    def build_config(cls, stage, trial_creds=False, trial_global_env_bucket=False,
                     security_group_ids=None, subnet_ids=None):
        """ Builds the chalice config json file. See: https://aws.github.io/chalice/topics/configfile"""
        # key to de-encrypt access key
        if trial_creds:
            s3_enc_secret = os.environ.get("TRIAL_S3_ENCRYPT_KEY")
            client_id = os.environ.get("TRIAL_CLIENT_ID")
            client_secret = os.environ.get("TRIAL_CLIENT_SECRET")
            dev_secret = os.environ.get("TRIAL_DEV_SECRET")
            if not (s3_enc_secret and client_id and client_secret and dev_secret):
                print(''.join(['ERROR. You are missing one more more environment ',
                               'variables needed to deploy the Foursight trial.\n',
                               'Need: TRIAL_S3_ENCRYPT_KEY, TRIAL_CLIENT_ID, TRIAL_CLIENT_SECRET, TRIAL_DEV_SECRET.'])
                      )
                sys.exit()
        else:
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
            if trial_global_env_bucket:
                global_bucket = os.environ.get('GLOBAL_BUCKET_ENV')
                if global_bucket:
                    cls.CONFIG_BASE['stages'][curr_stage]['environment_variables']['GLOBAL_BUCKET_ENV'] = global_bucket
                else:
                    print('ERROR. GLOBAL_BUCKET_ENV must be set when building the trial config.')
                    sys.exit()
            if security_group_ids:
                cls.CONFIG_BASE['stages'][curr_stage]['security_group_ids'] = security_group_ids
            if subnet_ids:
                cls.CONFIG_BASE['stages'][curr_stage]['subnet_ids'] = subnet_ids

        filename = cls.get_config_filepath()
        print(''.join(['Writing: ', filename]))
        with open(filename, 'w') as config_file:
            config_file.write(json.dumps(cls.CONFIG_BASE))
        # export poetry into requirements
        subprocess.check_call(
            ['poetry', 'export', '-f', 'requirements.txt', '--without-hashes', '-o', 'requirements.txt'])

    @classmethod
    def build_config_and_deploy(cls, stage):
        cls.build_config(stage)
        # actually deploy
        subprocess.call(['chalice', 'deploy', '--stage', stage])

    @classmethod
    def build_config_and_package(cls, args):
        if args.trial:
            hardcoded_security_ids = ['sg-06bb5c4df5a1a9a04']  # TODO fetch these dynamically
            hardcoded_subnet_ids = ['subnet-0a137caf0516c45b3', 'subnet-00b408971fc21de17']
            cls.build_config(args.stage, trial_creds=True, trial_global_env_bucket=True,
                             security_group_ids=hardcoded_security_ids, subnet_ids=hardcoded_subnet_ids)
        else:
            cls.build_config(args.stage)
        # actually package cloudformation templates
        # add --single-file ?
        flags = ['--stage', args.stage, '--pkg-format', 'cloudformation', '--template-format', 'yaml']
        if args.merge_template:
            flags.extend(['--merge-template', args.merge_template])
        subprocess.call(['chalice', 'package', *flags, args.output_file])


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
