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
    public List<String> listNamespaces(String contextName) {
        return namespaceResponses.getOrDefault(contextName, List.of());
    }

    @Override
    public boolean namespaceExists(String contextName, String namespace) {
        return true;
    }

    @Override
    public ResourceTable listResources(String contextName, String namespace, String resourceType) {
        var key = contextName + "/" + namespace + "/" + resourceType;
        return resourceTableResponses.getOrDefault(key,
                new ResourceTable(resourceType, List.of(), List.of()));
    }

    @Override
    public String getResource(String contextName, String namespace, String resourceType, String name) {
        var key = contextName + "/" + namespace + "/" + resourceType + "/" + name;
        return resourceDetailResponses.getOrDefault(key, null);
    }
}
