import os
import json
from typing import Tuple
from dcicutils.misc_utils import ignored
from elasticsearch import (
    # Elasticsearch,
    # TransportError,
    RequestError,
    ConnectionTimeout
    )
from elasticsearch_dsl import Search
from dcicutils import es_utils
from foursight_core.abstract_connection import AbstractConnection
from foursight_core.check_schema import CheckSchema


class ElasticsearchException(Exception):
    """ Generic exception for an elasticsearch failure """
    def __init__(self, message=None):
        if message is None:
            self.message = "No error message given, this shouldn't happen!"
        else:
            self.message = message
        super().__init__(message)


class ESConnection(AbstractConnection):
    """
    ESConnection is a handle to a remote ElasticSearch instance on AWS.
    All Foursight connections make use of the same ES instance but have separate
    indices for each one, such as 'foursight-dev-cgap', 'foursight-dev-data' etc

    ESConnection is intended to work with only a single index.

    Implements the AbstractConnection 'interface'
    """

    ES_SEARCH_SIZE = 10000

    def __init__(self, index=None, host=None):
        if not host:
            raise ElasticsearchException("ESConnection error: Host must be specified")
        self.es = es_utils.create_es_client(host, use_aws_url=True)
        self.index = index
        if index and not self.index_exists(index):
            self.create_index(index)

    def index_exists(self, name):
        """
        Checks if the given index name exists
        """
        return self.es.indices.exists(index=name)

    def create_index(self, name):
        """
        Creates an ES index called name. Returns true in success
        """
        try:
            mapping = self.load_mapping()
            self.es.indices.create(index=name, body=mapping, ignore=400)
            return True
        except Exception as e:
            raise ElasticsearchException(str(e))

    def load_mapping(self, fname='mapping.json'):
        """
        Loads ES mapping from 'mapping.json' or another relative path from this
        file location.
        """
        return self.load_json(__file__, fname)

    @classmethod
    def load_json(cls, rel, fname):
        """ Loads json file fname from rel/fname """
        path = os.path.join(os.path.dirname(rel), fname)
        with open(path, 'r') as f:
            return json.load(f)

    def delete_index(self, name):
        """
        Deletes the given index name from this es
        """
        try:
            self.es.indices.delete(index=name, ignore=[400, 404])
        except Exception:
            return False
        return True

    def refresh_index(self):
        """
        Refreshes the index (wait removed, no need for it)
        """
        return self.es.indices.refresh(index=self.index)

    def put_object(self, key, value):
        """
        Index a new item into es. Returns true in success
        """
        if not self.index:
            return False
        try:
            res = self.es.index(index=self.index, id=key, body=value)
            return res['result'] == 'created'
        except Exception as e:
            print('Failed to add object id: %s with error: %s and body %s' % (key, str(e), value))
            return False

    def get_object(self, key):
        """
        Gets object with uuid=key from es. Returns None if not found or no index
        has been specified.
        """
        if not self.index:
            return None
        try:
            return self.es.get(index=self.index, id=key)['_source']
        except Exception:
            return None

    def get_size(self):
        """
        Returns the number of items indexed on this es instance. Returns -1 in
        failure.
        """
        try:
            return self.es.count(index=self.index).get('count')
        except Exception as e:
            print(f'Failed to execute count: {e}')
            return 0

    def get_size_bytes(self):
        """
        Returns number of bytes stored on this es instance
        """
        if not self.index:
            return 0
        resp = self.es.indices.stats(index=self.index, metric='store')
        return resp['_all']['total']['store']['size_in_bytes']

    def search(self, search, key='_source') -> Tuple[list, int]:
        """
        Inner function that passes doc as a search parameter to ES. Based on the
        execute_search method in Fourfront.
        Returns a tuple with search results as a list and the total count as an integer.
        """
        if not self.index:
            return [], 0
        err_msg = None
        try:
            res = search.execute().to_dict()
        except ConnectionTimeout:
            err_msg = 'The search failed due to a timeout. Please try a different query.'
        except RequestError as exc:
            try:
                err_detail = str(exc.info['error']['root_cause'][0]['reason'])
            except Exception:
                err_detail = str(exc)
            err_msg = 'The search failed due to a request error: ' + err_detail
        except Exception as exc:
            err_msg = 'Search failed. Error: %s' % str(exc)
        if err_msg:
            raise ElasticsearchException(message=err_msg)
        # In next line, PyCharm's linter wrongly worries that 'res' might not be reliably set above. -kmp 6-Jun-2022
        else:
            total = self.get_hits_total(res)
            return [obj[key] for obj in res['hits']['hits']] if len(res['hits']['hits']) > 0 else [], total  # noQA

    @staticmethod
    def get_hits_total(result: dict) -> int:
        total = result["hits"]["total"]
        # As of ES7 we have result.hits.total.value rather than result.hits.total.
        if not isinstance(total, int):
            total = total["value"]
        return total

    def get_result_history(self, prefix, start, limit, sort="timestamp.desc") -> [list, int]:
        """
        ES handle to implement the get_result_history functionality of RunResult
        """
        sort_field = "uuid"
        sort_order = "desc"
        if sort:
            if sort.endswith(".desc"):
                sort_order = "desc"
                sort_field = sort[:-5]
            elif sort.endswith(".asc"):
                sort_order = "asc"
                sort_field = sort[:-4]
            else:
                sort_order = "asc"
                sort_field = sort
            if sort_field == "timestamp":
                sort_field = "uuid"
        doc = {
            'from': start,
            'size': limit,
            'sort': {
                sort_field: {'order': sort_order}
            },
            'query': {
                'bool': {
                    'must_not': [
                        {'term': {'_id': prefix + '/primary.json'}},
                        {'term': {'_id': prefix + '/latest.json'}}
                    ],
                    'filter': {
                        # use MATCH so our 'prefix' is analyzed like the source field 'name', see mapping
                        'match': {'name': prefix}
                    }
                }
            }
        }
        search = Search(using=self.es, index=self.index)
        search.update_from_dict(doc)
        result, total = self.search(search)
        return result, total

    def get_main_page_checks(self, checks=None, primary=True):
        """
        Gets all checks for the main page. If primary is true then all checks will
        be primary, otherwise we use latest.
        Only gets ES_SEARCH_SIZE number of results, most recent first.
        """
        if primary:
            t = 'primary'
        else:
            t = 'latest'
        doc = {
            'size': self.ES_SEARCH_SIZE,
            'query': {
                'bool': {
                    'must': {
                        'query_string': {
                            'query': 'id_alias:"*' + t + '.json"'
                        }
                    },
                    'filter': {
                        'term': {'type': 'check'}
                    }
                }
            },
            'sort': {
                'uuid': {
                    'order': 'desc'
                }
            }
        }
        search = Search(using=self.es, index=self.index)
        search.update_from_dict(doc)
        raw_result, total = self.search(search)
        ignored(total)
        if checks is not None:
            # figure out which checks we didn't find, add a placeholder check so
            # that check is still rendered on the UI
            raw_result = list(filter(lambda res: res['name'] in checks, raw_result))
            found_checks = set(res['name'] for res in raw_result)
            for check_name in checks:
                if check_name not in found_checks:
                    raw_result.append(CheckSchema().create_placeholder_check(check_name))
        return raw_result

    def list_all_keys(self):
        """
        Generic search on es that will return all ids of indexed items
        Only gets ES_SEARCH_SIZE number of results, most recent first.
        """
        doc = {
            'size': self.ES_SEARCH_SIZE,
            'query': {
                'match_all': {}
            },
            'sort': {
                'uuid': {
                    'order': 'desc'
                }
            }
        }
        search = Search(using=self.es, index=self.index)
        search.update_from_dict(doc)
        result, total = self.search(search, key='_id')
        ignored(total)
        return result

    def list_all_keys_w_prefix(self, prefix):
        """
        Lists all id's in this ES that have the given prefix.
        Only gets ES_SEARCH_SIZE number of results, most recent first.
        """
        doc = {
            'size': self.ES_SEARCH_SIZE,
            'query': {
                'bool': {
                    'filter': {
                        'term': {'name': prefix}
                    }
                }
            },
            'sort': {
                'uuid': {
                    'order': 'desc'
                }
            }
        }
        search = Search(using=self.es, index=self.index)
        search.update_from_dict(doc)
        result, total = self.search(search, key='_id')
        ignored(total)
        return result

    def get_all_objects(self):
        """
        Calls list_all_keys with full=True to get all the objects
        Only gets ES_SEARCH_SIZE number of results, most recent first.
        """
        doc = {
            'size': self.ES_SEARCH_SIZE,
            'query': {
                'match_all': {}
            },
            'sort': {
                'uuid': {
                    'order': 'desc'
                }
            }
        }
        search = Search(using=self.es, index=self.index)
        search.update_from_dict(doc)
        result, total = self.search(search)
        ignored(total)
        return result

    def delete_keys(self, key_list):
        """
        Deletes all uuids in key_list from es. If key_list is large this will be
        a slow operation, but probably still not as slow as s3
        """
        query = {
            'query': {
                'terms': {'_id': key_list}
            }
        }
        try:
            res = self.es.delete_by_query(index=self.index, body=query)
            return res['deleted']
        except Exception:
            return 0

    def test_connection(self):
        """
        Hits health route on es to verify that it is up
        """
        return self.es.ping()

    def info(self):
        """
        Returns basic info about the Elasticsearch server. 
        """
        return self.es.info()

    def health(self):
        """
        Returns basic health about the Elasticsearch server cluster.
        """
        return self.es.cluster.health()
