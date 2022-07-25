==============
foursight-core
==============

----------
Change Log
----------


0.7.4
=====

IDENTITY-ized Foursight; i.e. get secrets and other configuration data from the global application configuration (GAC)
rather than having them encoded in the environment via the CloudFormation template (for the lambdas). C4-826.


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


