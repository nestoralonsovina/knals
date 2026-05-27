package dev.knals.server;

import io.fabric8.kubernetes.client.Config;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class KubernetesService {

    private static final int TIMEOUT_MS = 5000;

    public List<String> listNamespaces(String contextName) {
        try {
            var config = Config.autoConfigure(contextName);
            config.setConnectionTimeout(TIMEOUT_MS);
            config.setRequestTimeout(TIMEOUT_MS);
            try (var client = new KubernetesClientBuilder().withConfig(config).build()) {
                return client.namespaces().list().getItems().stream()
                        .map(ns -> ns.getMetadata().getName())
                        .toList();
            }
        } catch (Exception e) {
            return List.of();
        }
    }

    public boolean namespaceExists(String contextName, String namespace) {
        try {
            var config = Config.autoConfigure(contextName);
            config.setConnectionTimeout(TIMEOUT_MS);
            config.setRequestTimeout(TIMEOUT_MS);
            try (var client = new KubernetesClientBuilder().withConfig(config).build()) {
                var ns = client.namespaces().withName(namespace).get();
                return ns != null;
            }
        } catch (Exception e) {
            return false;
        }
    }
}
