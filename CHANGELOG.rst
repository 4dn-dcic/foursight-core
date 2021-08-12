==============
foursight-core
==============

----------
Change Log
----------


0.3.0
=====

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


Older Versions
==============

A record of older changes can be found
`in GitHub <https://github.com/4dn-dcic/foursight-core/pulls?q=is%3Apr+is%3Aclosed>`_.
To find the specific version numbers, see the ``version`` value in
the ``poetry.app`` section of ``pyproject.toml``, as in::

   [poetry.app]
   name = "foursight-core"
   version = "100.200.300"
   ...etc.

