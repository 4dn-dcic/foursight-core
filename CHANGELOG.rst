==============
foursight-core
==============

----------
Change Log
----------

2.1.1
=====
* Changes related to a new experimental /accounts page in Foursight which can show summary
  Foursight and Portal info from other AWS accounts. To take advantage of it there is an
  accounts.json file in the chalicelib_cgap or chalicelib_fourfront directory, for
  Foursight-CGAP and foursight-Fourfront, respectively, which contains a simple list
  of Foursight URLs for other AWS accounts. If this file is not present no harm.
  This file has been manually encrypted, since it contains internal URLs, using
  the ENCODED_AUTH0_SECRET value in the Global Application Configuration (GAC)
  in the AWS Secrets Manager. There are convenience poetry scripts, to encrypt
  and/or decrypt this file locally: encrypt-accounts-file, decrypt-accounts-file.
  Change to both the API and UI have been made for this.
* Moved lookup of check_setup.json (and accounts.json) to here, from
  foursight-cgap/chalicelib_cap/app_utils.py and foursight/chalicelib_cap/app_utils.py.
* Fix for C4-949: Show full_output as JSON (YAML actually) correctly in check run outputs.
* Disable user edit in readonly mode.
* Miscellaneous UI cleanup; very gradually more componentization and better CSS.


2.1.0
=====
* React-ifying Foursight.
  * Many changes.
  * React UI code in react directory.
  * React API code in foursight_core/react directory.
  * Moved all foursight-cgap and foursight Chalice routes to here.
  * Old Foursight still works side-by-side with React version.



2.0.2
=====
* Change some print statements to logger.debug in check_utils.py


2.0.0
=====

* Spruced up Foursight UI a bit.
  * New header/footer.
    * Different looks for Foursight-CGAP (blue header) and Foursight-Fourfront (green header).
    * More relevant info in header (login email, environment, stage).
  * New /info and /users page.
  * New /users and /users/{email} page.
  * New dropdown to change environments.
  * New logout link.
  * New specific error if login fails due to no user record for environment.


1.0.2
=====

* Repair changelong for 1.0.1

(There was also a need for this version to be higher than some beta versions that are in play.)


1.0.1
=====

* Fix the way check lookup works


1.0.2
=====

* Repair changelong for 1.0.1

(There was also a need for this version to be higher than some beta versions that are in play.)


1.0.1
=====

* Fix the way check lookup works


1.0.0
=====

* IDENTITY-ized Foursight; i.e. get secrets and other configuration data from the global application configuration (GAC)
  rather than having them encoded in the environment via the CloudFormation template (for the lambdas). C4-826.
  * Added STACK_NAME (in addition to IDENTITY introduced in 0.7.4.2b0) to the environment variables
    required (via the Foursight CloudFormation template) to get a foothold for other Foursight info,
    e.g. to get the CHECK_RUNNER AWS lambda function name. See AppUtilsCore.apply_identity_globally
    in app_utils.py and Deploy.build_config in deploy.py. C4-826.
  * Assume RDS_NAME is now in GAC (via 4dn-cloud-infra 3.4.0).
  * Moved apply_identity_globally to its own identity.py module and
    call it statically from app_utils.py/AppUtilsCore class. C4-826.
* Merged in Kent's changes from PR-27 (to environment.py and check_utils.py WRT environment names).
* Merged in more of Kent's changes from PR-27 (to environment.py and check_utils.py WRT environment names).
* Added better error message for NoSuchKey for S3 bucket key access (s3_connection.py/get_object).
* Updated dcicutils to ^4.0.2.


0.7.5
=====

Fix Environment.is_valid_environment_name to return true of various environments.



0.7.4
=====

Fix a bug in Environment.get_environment_and_bucket_info


0.7.3
=====

Relocked pyproject.toml from scratch.
No other changes.


0.7.2
=====

0.7.1
=====

Versions 0.7.1 and 0.7.2 offer no change from 0.7.0 except version.
Just trying to debug a problem at pypi.


0.7.0
=====

**PR #22: Miscellaneous changes in support of using new env_utils**

* This tries to make use of the support in a recent utils beta to get a foothold on the foursight environment
  in a more abstract and configurable way.


0.6.1
=====

**PR #23: Mostly PEP8**

* Address many PEP8 issues.
* Include ``flake8`` among dev dependencies.
* Add ``make lint`` to run ``flake8``.
* Bring ``CHANGELOG.rst`` up to date.


0.6.0
=====

**PR #21: Python 3.7 support (C4-765)**

* Adjusts python requirement to permit Python 3.7, but still allow 3.6.1 and above.
  No known incompatibilities.

0.5.0
=====

**PR #20: Support Encrypted Buckets**

* Small changes needed for encrypted buckets


0.4.5
=====

(Records are uncertain here.)


0.4.4
=====

**PR #19: Repair delete_results**

* Fix for problem where``delete_results`` had inconsistent return type,
  causing ``foursight-cgap`` to crash in the scenario where no checks are to be cleaned.
  With this change, it returns a tuple as the docstring says.


0.4.3
=====

**PR #18: Enable RDS Snapshots (1/3)**

* *Needs update*


0.4.2
=====

**PR #17: Changes to remove variable imports from env_utils (C4-700)**

* *Needs update*


0.4.1
=====

**PR #16: Remove dev_secret**


0.4.0
=====

There was no version 0.4.0.


0.3.0
=====

**PR #15: Update for dcicutils 2.0**

**PR #14: Add publishing support**

**PR #13: Fix C4-691 and C4-692 regarding information passing into foursight-core building operations**

**PR #9: foursight-core: chalice package support C4-554 (1/3)**


Compatible/transitional support for:

* Fix for `foursight-core Deploy.build_config_and_package should take global_env_bucket as an argument (C4-691)
  <https://hms-dbmi.atlassian.net/browse/C4-691>`_: Allow environment variable (either one,
  checking for consistency if both are set) or an argument.
  If the argument is passed, it takes precedence even if not consistent with environment variables.

* Fix for `foursight-core Deploy.build_config_and_package should not need an 'args' arg
  <https://hms-dbmi.atlassian.net/browse/C4-692>`_: Allow any of four new named arguments to override
  the various parts of ``args`` that might get used. So passing ``merge_template=`` causes that value to be
  used in lieu of ``args.merge_template``, and ``output_file=`` gets used in lieu of ``args.output_file``,
  and ``stage=`` gets used instead of ``args.stage``, and ``trial=`` gets used in place of ``args.trial``.


0.2.0
=====

**PR #12: Repair Auth0**


0.1.11
======

**PR #11: remove fuzzywuzzy dependency**


0.1.10
======

* **Needs more info**


0.1.9
=====

**PR #10: Update buckets.py**


0.1.8
=====

**PR #8: Collect run info**


0.1.7
=====

**PR #6: delete check_runs_without_output function wfr_utils.py**


0.1.6:
======

**PR #7: Fix visibility timeout**

* SQS visibility timeout was set to 5 mins but should be 15 mins to reflect the updated lambda timeout.


0.1.5
=====

There was no version 0.1.5


0.1.4
=====

**PR #5: fix for bug AppUtils object has no attribute get_schedule_names**


0.1.3
=====

**PR #4: Core3**


0.1.2
=====

**PR #3: Add GA Workflows**


0.1.1
=====

**PR #2: Core2**

* minor fixes


0.1.0
=====

**PR #1: Core2**


