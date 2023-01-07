import yaml


def load_yaml(yaml_string: str) -> dict:
    """
    Loads the given YAML string and returns it as a dictionary.
    If an error occurs on load then and empty dictionary is returned.
    """
    try:
        return yaml.load(yaml_string, Loader=yaml.Loader)
    except Exception:
        return {}


class _Ref(yaml.YAMLObject):
    yaml_tag = '!Ref'
    def __init__(self, val):
        self.val = val
    @classmethod
    def from_yaml(cls, loader, node):
        return str(node.value)


class _Sub(yaml.YAMLObject):
    yaml_tag = '!Sub'
    def __init__(self, val):
        self.val = val
    @classmethod
    def from_yaml(cls, loader, node):
        return str(node.value)


class _Join(yaml.YAMLObject):
    yaml_tag = '!Join'
    def __init__(self, val):
        self.val = val
    @classmethod
    def from_yaml(cls, loader, node):
        return str(node.value)


class _GetAtt(yaml.YAMLObject):
    yaml_tag = '!GetAtt'
    def __init__(self, val):
        self.val = val
    @classmethod
    def from_yaml(cls, loader, node):
        return str(node.value)


class _ImportValue(yaml.YAMLObject):
    yaml_tag = '!ImportValue'
    def __init__(self, val):
        self.val = val
    @classmethod
    def from_yaml(cls, loader, node):
        return str(node.value)
