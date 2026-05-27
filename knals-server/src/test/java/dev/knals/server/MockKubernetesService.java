package dev.knals.server;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Alternative
@Priority(1)
@ApplicationScoped
public class MockKubernetesService extends KubernetesService {

    private static final Map<String, List<String>> namespaceResponses = new ConcurrentHashMap<>();
    private static final Map<String, ResourceTable> resourceTableResponses = new ConcurrentHashMap<>();
    private static final Map<String, String> resourceDetailResponses = new ConcurrentHashMap<>();

    public static void stubListNamespaces(String context, List<String> namespaces) {
        namespaceResponses.put(context, namespaces);
    }

    public static void stubListResources(String context, String namespace, String type, ResourceTable table) {
        resourceTableResponses.put(context + "/" + namespace + "/" + type, table);
    }

    public static void stubGetResource(String context, String namespace, String type, String name, String json) {
        if (json != null) {
            resourceDetailResponses.put(context + "/" + namespace + "/" + type + "/" + name, json);
        }
    }

    public static void reset() {
        namespaceResponses.clear();
        resourceTableResponses.clear();
        resourceDetailResponses.clear();
    }

    @Override
    public KubeResult<List<String>> listNamespaces(String contextName) {
        var result = namespaceResponses.get(contextName);
        return new KubeResult.Success<>(result != null ? result : List.of());
    }

    @Override
    public KubeResult<Boolean> namespaceExists(String contextName, String namespace) {
        return new KubeResult.Success<>(true);
    }

    @Override
    public KubeResult<ResourceTable> listResources(String contextName, String namespace, String resourceType) {
        var key = contextName + "/" + namespace + "/" + resourceType;
        var table = resourceTableResponses.get(key);
        return new KubeResult.Success<>(table != null ? table : new ResourceTable(resourceType, List.of(), List.of()));
    }

    @Override
    public KubeResult<String> getResource(String contextName, String namespace, String resourceType, String name) {
        var key = contextName + "/" + namespace + "/" + resourceType + "/" + name;
        var json = resourceDetailResponses.get(key);
        if (json == null) return new KubeResult.NotFound<>(resourceType + "/" + name);
        return new KubeResult.Success<>(json);
    }
}
