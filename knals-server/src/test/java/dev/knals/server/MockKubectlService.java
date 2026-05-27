package dev.knals.server;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Alternative
@Priority(1)
@ApplicationScoped
public class MockKubectlService extends KubectlService {

    private static final Map<String, KubectlResult> describeResponses = new ConcurrentHashMap<>();
    private static KubectlResult defaultResult = new KubectlResult.NotFound("not found");

    public static void stubDescribe(String context, String namespace, String type, String name, KubectlResult result) {
        describeResponses.put(context + "/" + namespace + "/" + type + "/" + name, result);
    }

    public static void setDefaultResult(KubectlResult result) {
        defaultResult = result;
    }

    public static void reset() {
        describeResponses.clear();
        defaultResult = new KubectlResult.NotFound("not found");
    }

    @Override
    public KubectlResult describe(String context, String namespace, String type, String name) {
        var key = context + "/" + namespace + "/" + type + "/" + name;
        return describeResponses.getOrDefault(key, defaultResult);
    }
}
