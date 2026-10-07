from types import SimpleNamespace
import subprocess

import pytest
import foursight_core.deploy as deploy_module
from foursight_core.deploy import Deploy


def _package(monkeypatch, tmp_path, **prune_options):
    calls = []
    output_file = str(tmp_path / "package")

    monkeypatch.setattr(Deploy, "build_config", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        deploy_module,
        "subprocess_call",
        lambda command, **kwargs: calls.append(command),
    )
    monkeypatch.setattr(
        deploy_module.os.path,
        "exists",
        lambda filename: filename.endswith("scripts/prune_chalice_package.sh")
        or filename.endswith("deployment.zip"),
    )

    args = SimpleNamespace(
        stack="not-a-fourfront-or-smaht-stack",
        merge_template=None,
        output_file=output_file,
        stage="dev",
        trial=False,
    )
    Deploy.build_config_and_package(args, **prune_options)
    return calls, output_file


def test_deploy_default_lambda_timeout():
    assert Deploy.DEFAULT_LAMBDA_TIMEOUT == 60 * 15  # 15 minutes


def test_build_config_and_package_preserves_default_prune_invocation(monkeypatch, tmp_path):
    calls, output_file = _package(monkeypatch, tmp_path)

    assert calls[-1] == [
        f"{deploy_module.os.getcwd()}/scripts/prune_chalice_package.sh",
        f"{output_file}/deployment.zip",
    ]


def test_build_config_and_package_passes_dry_run(monkeypatch, tmp_path):
    calls, output_file = _package(monkeypatch, tmp_path, dry_run=True)

    assert calls[-1] == [
        f"{deploy_module.os.getcwd()}/scripts/prune_chalice_package.sh",
        "--dry-run",
        f"{output_file}/deployment.zip",
    ]


def test_build_config_and_package_passes_report(monkeypatch, tmp_path):
    calls, output_file = _package(monkeypatch, tmp_path, report=True)

    assert calls[-1] == [
        f"{deploy_module.os.getcwd()}/scripts/prune_chalice_package.sh",
        "--report",
        f"{output_file}/deployment.zip",
    ]


def test_build_config_and_package_passes_variant(monkeypatch, tmp_path):
    calls, output_file = _package(monkeypatch, tmp_path, variant="minimal")

    assert calls[-1] == [
        f"{deploy_module.os.getcwd()}/scripts/prune_chalice_package.sh",
        "--variant",
        "minimal",
        f"{output_file}/deployment.zip",
    ]


def test_build_config_and_package_skip_prune(monkeypatch, tmp_path):
    calls, _ = _package(monkeypatch, tmp_path, skip_prune=True)

    assert len(calls) == 1
    assert calls[0][0:2] == ["chalice", "package"]


def test_build_config_and_package_combines_prune_options(monkeypatch, tmp_path):
    calls, output_file = _package(
        monkeypatch,
        tmp_path,
        dry_run=True,
        report=True,
        variant="minimal",
    )

    assert calls[-1][1:] == [
        "--dry-run",
        "--report",
        "--variant",
        "minimal",
        f"{output_file}/deployment.zip",
    ]


def test_build_config_and_package_propagates_prune_failure(monkeypatch, tmp_path, capsys):
    calls = []
    output_file = str(tmp_path / "package")

    monkeypatch.setattr(Deploy, "build_config", lambda *args, **kwargs: None)

    def failing_subprocess_call(command, **kwargs):
        calls.append(command)
        return 23

    monkeypatch.setattr(deploy_module, "subprocess_call", failing_subprocess_call)
    monkeypatch.setattr(
        deploy_module.os.path,
        "exists",
        lambda filename: filename.endswith("scripts/prune_chalice_package.sh")
        or filename.endswith("deployment.zip"),
    )

    args = SimpleNamespace(
        stack="not-a-fourfront-or-smaht-stack",
        merge_template=None,
        output_file=output_file,
        stage="dev",
        trial=False,
    )
    with pytest.raises(subprocess.CalledProcessError) as error:
        Deploy.build_config_and_package(args)

    assert error.value.returncode == 23
    assert len(calls) == 2
    assert "Finished chalice package prune" not in capsys.readouterr().out
