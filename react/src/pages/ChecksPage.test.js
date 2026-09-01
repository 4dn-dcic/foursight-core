import axios from 'axios';
import { doRunAction, doRunCheck } from './ChecksPage';

function argsFromUrl(url) {
    const parsed = new URL(url);
    return JSON.parse(atob(parsed.searchParams.get("args")));
}

function makeGroupList() {
    return {
        update: jest.fn()
    };
}

function transformedAxiosRequest(request) {
    const headers = new axios.AxiosHeaders();
    const data = axios.defaults.transformRequest.reduce(
        (data, transform) => transform.call(axios.defaults, data, headers),
        request.payload
    );
    return { data, headers };
}

describe("manual check and action runs", () => {
    test("manual check run POST sends an explicit JSON payload and preserves encoded args", () => {
        const check = {
            name: "check_for_new_submissions",
            kwargs: {
                queue_action: "Not queued",
                note: "manual"
            }
        };
        const groupList = makeGroupList();
        const historyList = {
            prepend: jest.fn()
        };
        const fetch = jest.fn();

        doRunCheck(check, "cgap-test", groupList, historyList, fetch);

        expect(fetch).toHaveBeenCalledTimes(1);
        const request = fetch.mock.calls[0][0];
        expect(request).toMatchObject({
            method: "POST",
            payload: {}
        });
        const transformed = transformedAxiosRequest(request);
        expect(transformed.data).toBe("{}");
        expect(transformed.headers.getContentType()).toBe("application/json");
        expect(new URL(request.url).pathname).toBe("/api/reactapi/cgap-test/checks/check_for_new_submissions/run");
        expect(argsFromUrl(request.url)).toEqual(check.kwargs);
    });

    test("manual action run POST sends an explicit JSON payload and preserves encoded args", () => {
        const check = {
            name: "check_for_new_submissions",
            __result: {
                get: jest.fn((key) => key === "uuid" ? "2026-09-01T12:00:00.000000" : null)
            }
        };
        const groupList = makeGroupList();
        const fetch = jest.fn();

        doRunAction(check, "queue_ingestion", "cgap-test", groupList, fetch);

        expect(fetch).toHaveBeenCalledTimes(1);
        const request = fetch.mock.calls[0][0];
        expect(request).toMatchObject({
            method: "POST",
            payload: {}
        });
        const transformed = transformedAxiosRequest(request);
        expect(transformed.data).toBe("{}");
        expect(transformed.headers.getContentType()).toBe("application/json");
        expect(new URL(request.url).pathname).toBe("/api/reactapi/cgap-test/action/queue_ingestion/run");
        expect(argsFromUrl(request.url)).toEqual({
            check_name: "check_for_new_submissions",
            called_by: "2026-09-01T12:00:00.000000"
        });
    });
});
