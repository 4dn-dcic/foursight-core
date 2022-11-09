from conftest import *
from time import sleep
from foursight_core import es_connection


@pytest.fixture
def es(app_utils_obj_conn):
    app_utils_obj, conn = app_utils_obj_conn
    index = 'unit_test_index'
    try:
        es = es_connection.ESConnection(index, host=ES_HOST)
        es.delete_index(index)
    except Exception:
        es = None  # tests should be marked as skip
    return es


class TestESConnection:
    environ = DEV_ENV
    index = 'unit_test_index'

    @staticmethod
    def uuid(check):
        return check['name'] + '/' + check['uuid']

    def test_elasticsearch_exception(self):
        """
        Tests creating an ES exception
        """
        ex = es_connection.ElasticsearchException()
        assert ex.message == "No error message given, this shouldn't happen!"
        ex = es_connection.ElasticsearchException('test message')
        assert ex.message == 'test message'

    def test_basic_indexing(self, es):
        """
        Creates a test index, indexes a few check items, verifies they are
        there, deletes the index. These operations should all succeed.
        """
        assert es.test_connection()
        es.create_index(self.index)
        check = es.load_json(__file__, 'test_checks/check1.json')
        uuid = self.uuid(check)
        es.put_object(uuid, check)
        obj = es.get_object(uuid)
        assert (obj['name'] + '/' + obj['uuid']) == uuid
        sleep(3)  # if delete happens too soon it may not get picked up
        result = es.delete_keys([uuid])
        if not result:
            raise Exception('Did not delete from ES')
        es.refresh_index()

        assert es.get_object(uuid) is None
        assert es.get_size_bytes() > 0
        assert es.delete_index(self.index)

    def test_indexing_methods(self, es):
        """
        Creates a test index, indexes a few check items, uses additional methods
        to interact with the index, such as list_all_keys, get_all_objects
        """
        res = es.create_index(self.index)
        if not res:
            raise Exception('Could not create unit test index!')
        es.refresh_index()
        assert es.index_exists(self.index)
        check1 = es.load_json(__file__, 'test_checks/check1.json')
        check2 = es.load_json(__file__, 'test_checks/check2.json')
        check3 = es.load_json(__file__, 'test_checks/check3.json')
        es.put_object(self.uuid(check1), check1)
        es.put_object(self.uuid(check2), check2)
        es.refresh_index()
        keys = es.list_all_keys()
        assert self.uuid(check1) in keys
        assert self.uuid(check2) in keys
        assert self.uuid(check3) not in keys
        es.put_object(self.uuid(check3), check3)
        es.refresh_index()
        objs = es.get_all_objects()
        assert len(objs) == 3
        es.delete_keys([self.uuid(check1), self.uuid(check2)])
        es.refresh_index()
        keys = es.list_all_keys()
        assert len(keys) == 1
        assert self.uuid(check3) in keys
        assert es.delete_index(self.index)

    def test_indexing_failures(self, es):
        """
        Tests some failure cases with indexing
        """
        es.create_index(self.index)
        assert not es.index_exists('i_dont_exist')
        check1 = es.load_json(__file__, 'test_checks/check1.json')
        es.put_object(self.uuid(check1), check1)
        assert not es.put_object(self.uuid(check1), check1)
        es.refresh_index()
        assert len(es.list_all_keys_w_prefix('page_children_routes')) == 1
        assert len(es.list_all_keys_w_prefix('pag3_children_routes')) == 0
        fail_check = es.load_json(__file__, 'test_checks/fail_check.json')
        assert not es.put_object(self.uuid(fail_check), fail_check)
        assert es.delete_index(self.index)

    def test_result_history(self, es):
        """
        Indexes some items, checks that we get them when we use history search
        """
        assert es.create_index(self.index)
        check1 = es.load_json(__file__, 'test_checks/check1.json')
        check2 = es.load_json(__file__, 'test_checks/check2.json')
        check3 = es.load_json(__file__, 'test_checks/check3.json')
        check4 = es.load_json(__file__, 'test_checks/check4.json')
        assert es.put_object(self.uuid(check1), check1)
        assert es.put_object(self.uuid(check2), check2)
        assert es.put_object(self.uuid(check3), check3)
        assert es.put_object(self.uuid(check4), check4)
        assert es.refresh_index()
        assert es.get_size() == 4
        res = es.get_result_history('page_children_routes', 0, 25, sort=None)[0]
        assert len(res) == 3
        res = es.get_result_history('check_status_mismatch', 0, 25, sort=None)[0]
        assert len(res) == 1
        es.delete_index(self.index)

    @pytest.mark.parametrize('type', ['primary', 'latest'])  # needs latest as well
    def test_get_checks(self, es, type):
        """ Indexes some items, get primary result """
        es.create_index(self.index)
        check1 = es.load_json(__file__, 'test_checks/check1.json')
        check2 = es.load_json(__file__, 'test_checks/check2.json')
        check3 = es.load_json(__file__, 'test_checks/check3.json')
        check4 = es.load_json(__file__, 'test_checks/check4.json')
        es.put_object(self.uuid(check1), check1)
        es.put_object(self.uuid(check2), check2)
        # set id_alias so that main page checks function as intended
        key1 = 'page_children_routes/' + type + '.json'
        key2 = 'check_status_mismatch/' + type + '.json'
        check3['id_alias'] = key1
        check4['id_alias'] = key2
        es.put_object(key1, check3)
        es.put_object(key2, check4)
        es.refresh_index()
        if type == 'primary':
            res = es.get_main_page_checks()
        else:
            res = es.get_main_page_checks(primary=False)
        assert len(res) == 2
        checks_to_get = ['page_children_routes']
        if type == 'primary':
            res = es.get_main_page_checks(checks=checks_to_get)
        else:
            res = es.get_main_page_checks(checks=checks_to_get, primary=False)
        assert len(res) == 1
        es.delete_keys(['page_children_routes/' + type + '.json',
                        'check_status_mismatch/' + type + '.json'])
        es.refresh_index()
        if type == 'primary':
            res = es.get_main_page_checks()
        else:
            res = es.get_main_page_checks(primary=False)
        assert len(res) == 0
        es.delete_index(self.index)

    def test_search_failures(self, es):
        """
        Tests some errors for search
        """
        with pytest.raises(es_connection.ElasticsearchException):
            es.search(None)
