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
    def build_config(cls, stage, trial_creds=None, trial_global_env_bucket=False,
                     security_group_ids=None, subnet_ids=None, check_runner=None):
        """ Builds the chalice config json file. See: https://aws.github.io/chalice/topics/configfile"""
        if trial_creds:
            # key to decrypt access key
            s3_enc_secret = trial_creds['S3_ENCRYPT_KEY']
            client_id = trial_creds['CLIENT_ID']
            client_secret = trial_creds['CLIENT_SECRET']
            dev_secret = trial_creds['DEV_SECRET']
            es_host = trial_creds['ES_HOST']
            if not (s3_enc_secret and client_id and client_secret and dev_secret and es_host):
                print(''.join(['ERROR. You are missing one more more environment',
                               'variables needed to deploy the Foursight trial. Need:\n',
                               'S3_ENCRYPT_KEY, CLIENT_ID, CLIENT_SECRET, DEV_SECRET, ES_HOST in trial_creds dict.'])
                      )
                sys.exit()
        else:
            s3_enc_secret = os.environ.get("S3_ENCRYPT_KEY")
            client_id = os.environ.get("CLIENT_ID")
            client_secret = os.environ.get("CLIENT_SECRET")
            dev_secret = os.environ.get("DEV_SECRET")
            es_host = None  # not previously passed to config
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
            if es_host:
                cls.CONFIG_BASE['stages'][curr_stage]['environment_variables']['ES_HOST'] = es_host
            if trial_global_env_bucket:
                # in the trial account setup, use a shorter timeout
                cls.CONFIG_BASE['stages'][curr_stage]['lambda_timeout'] = 60
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
            if check_runner:
                cls.CONFIG_BASE['stages'][curr_stage]['environment_variables']['CHECK_RUNNER'] = check_runner

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
    def build_config_and_package(cls, args, trial_creds=None, security_ids=None, subnet_ids=None, check_runner=None):
        """ Builds a config with a special case for the trial account. For the trial account, expects a dictionary of
            environment variables, a list of security group ids, and a list of subnet ids. Finally, packages as a
            Cloudformation template."""
        if args.trial:
            if trial_creds and security_ids and subnet_ids and check_runner:
                cls.build_config(args.stage, trial_creds=trial_creds, trial_global_env_bucket=True,
                                 security_group_ids=security_ids, subnet_ids=subnet_ids, check_runner=check_runner)
            else:
                raise Exception('Build config requires trial_creds, sg id, and subnet ids to run in trial account')
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
