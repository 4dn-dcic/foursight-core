import yaml


def load_yaml(yaml_string: str) -> dict:
    """
    Loads the given YAML string and returns it as a dictionary.
    If an error occurs on load then and empty dictionary is returned.
    """
    try:
        return yaml.load(yaml_string, Loader=yaml.Loader)
    except Exception:
        return {"error": "Cannot parse YAML."}


class _SpecialTag(yaml.YAMLObject):
    yaml_tag = None
    def __init__(self, val):
        self.val = val
    @classmethod
    def from_yaml(cls, loader, node):
        return str(node.value)


class _Ref(_SpecialTag):
    yaml_tag = '!Ref'


class _Sub(_SpecialTag):
    yaml_tag = '!Sub'


class _Join(_SpecialTag):
    yaml_tag = '!Join'


class _GetAtt(_SpecialTag):
    yaml_tag = '!GetAtt'


class _ImportValue(_SpecialTag):
    yaml_tag = '!ImportValue'
