ECS task launch network discovery
=================================

The React ``GET /aws/ecs/tasks_for_running/{task_name}`` endpoint supplies the
network displayed on the reindex page. Its resolver is
``foursight_core/react/api/aws_ecs_task_network.py``. Opening the page discovers
configuration; it does not launch an ECS task.

Network authority
-----------------

The environment must identify exactly one ECS cluster using the existing
environment/cluster association rules. The resolver reads that cluster's active
services with paginated ``ListServices`` and batched ``DescribeServices`` calls.
It uses the deployed ``awsvpcConfiguration`` for services with the requested task
definition family, ignoring revision differences. If no service uses that family
(as with standalone deployment/reindex tasks), all active services must agree on
the same subnet and security-group IDs before their network can be reused.

Every configured subnet and security group must exist in EC2 and belong to the
same VPC. The response retains the existing ``vpc``, ``subnets`` and singular
``security_group`` fields. Configurations with multiple security groups are
rejected rather than silently dropping groups. Service discovery is reused
within one endpoint request and refreshed on the next request.

This network is independent of the Foursight Lambda's placement. Lambda subnets
and security groups are not a source for ECS task launch parameters. VPC display
names containing ``main`` are not used to select a VPC in a multi-VPC account.

Compatibility and unresolved configuration
------------------------------------------

When no active services exist, the compatibility fallback requires exactly one
account VPC. It retains the standard environment-associated ``container`` group
convention, requiring exactly one matching group. Private subnet selection keeps
the existing ``main``/environment-name preference, but every candidate must be
inside that sole VPC. Without a unique group or private subnets it fails closed.

Missing or ambiguous clusters, conflicting service networks, missing resources,
cross-VPC membership and unavailable AWS reads return a per-task ``network_error``
code and omit all launch network fields. The existing UI consequently disables
launching and shows its missing-network warnings. The code is also logged without
AWS exception text. Permission errors never fall back to name-based selection;
an unreadable service network must not be replaced by a guess.

Permissions and rollout
-----------------------

The Foursight execution role needs ``ecs:ListServices`` for the relevant clusters
and ``ecs:DescribeServices`` for their services, in addition to the existing ECS
task/cluster discovery and ``ec2:DescribeVpcs``, ``ec2:DescribeSubnets`` and
``ec2:DescribeSecurityGroups`` reads. Scope service reads to the application
services where IAM supports resource restrictions; constrain ``ListServices``
to the intended clusters through its ``ecs:cluster`` condition. This resolver
does not require ``lambda:GetFunctionConfiguration`` or ENI discovery.

Read-only dev-SRCE verification on 2026-09-30, after validating STS identity,
found three VPCs. The portal, indexer and ingester services shared one network
with two subnets and one security group. The inspected Foursight Lambda networks
did not match that ECS network. The modified resolver returned a complete network
for the live deployment task definition. IAM policy simulations allowed both
ECS service reads for the inspected Foursight roles; this was not an invocation
under a Lambda execution role or a verification of organization SCPs.

Roll out any missing execution-role read permissions first, then release the
core change. In ``foursight-smaht``, update the ``foursight-core`` dependency to
the released version and refresh ``poetry.lock`` before redeploying the SRCE
Foursight application. Its current ``^5.4.0`` constraint can admit a later 5.x
release, but an older lockfile must still be refreshed. Verify the deployed GET
response and reindex page against the ECS service network without launching a
task, and spot-check a standard single-VPC environment. A dependency rollback
and Foursight redeployment restore the previous behavior. This rollout is
separate from deploy-time Lambda placement changes in ``4dn-cloud-infra``.

Offline regression tests
------------------------

Run ``python -m pytest -q tests/test_react_aws_ecs_tasks.py`` with project
dependencies installed. This module overrides the repository's live SQS session
fixture, so its tests do not initialize or purge AWS queues. Coverage includes
the SRCE multi-VPC response, single-VPC compatibility, ambiguous configurations,
missing resources, unavailable permissions and cross-VPC rejection. The full
repository suite has a live SQS initialization/purge fixture and must not be run
against a real account as part of read-only verification.
