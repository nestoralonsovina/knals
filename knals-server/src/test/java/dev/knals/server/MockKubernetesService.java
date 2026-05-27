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

    private static final Map<String, List<String>> responses = new ConcurrentHashMap<>();

    public static void stubListNamespaces(String context, List<String> namespaces) {
        responses.put(context, namespaces);
    }

    public static void reset() {
        responses.clear();
    }

    @Override
    public List<String> listNamespaces(String contextName) {
        return responses.getOrDefault(contextName, List.of());
    }

    @Override
    public boolean namespaceExists(String contextName, String namespace) {
        return true;
    }
}
