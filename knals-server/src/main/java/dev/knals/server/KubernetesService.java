package dev.knals.server;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.fabric8.kubernetes.client.Config;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import io.fabric8.kubernetes.client.http.HttpRequest;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class KubernetesService {

    private static final int TIMEOUT_MS = 5000;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final Map<String, String> RESOURCE_API_PATHS = Map.ofEntries(
            Map.entry("pods", "/api/v1"),
            Map.entry("services", "/api/v1"),
            Map.entry("configmaps", "/api/v1"),
            Map.entry("secrets", "/api/v1"),
            Map.entry("serviceaccounts", "/api/v1"),
            Map.entry("events", "/api/v1"),
            Map.entry("pvcs", "/api/v1"),
            Map.entry("deployments", "/apis/apps/v1"),
            Map.entry("replicasets", "/apis/apps/v1"),
            Map.entry("statefulsets", "/apis/apps/v1"),
            Map.entry("daemonsets", "/apis/apps/v1"),
            Map.entry("jobs", "/apis/batch/v1"),
            Map.entry("cronjobs", "/apis/batch/v1"),
            Map.entry("ingresses", "/apis/networking.k8s.io/v1")
    );

    private static final Map<String, String> RESOURCE_NAMES = Map.ofEntries(
            Map.entry("pods", "pods"),
            Map.entry("services", "services"),
            Map.entry("configmaps", "configmaps"),
            Map.entry("secrets", "secrets"),
            Map.entry("serviceaccounts", "serviceaccounts"),
            Map.entry("events", "events"),
            Map.entry("pvcs", "persistentvolumeclaims"),
            Map.entry("deployments", "deployments"),
            Map.entry("replicasets", "replicasets"),
            Map.entry("statefulsets", "statefulsets"),
            Map.entry("daemonsets", "daemonsets"),
            Map.entry("jobs", "jobs"),
            Map.entry("cronjobs", "cronjobs"),
            Map.entry("ingresses", "ingresses")
    );

    public static boolean isValidResourceType(String type) {
        return RESOURCE_API_PATHS.containsKey(type);
    }

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

    public ResourceTable listResources(String contextName, String namespace, String resourceType) {
        try {
            var config = Config.autoConfigure(contextName);
            config.setConnectionTimeout(TIMEOUT_MS);
            config.setRequestTimeout(TIMEOUT_MS);

            var apiPath = RESOURCE_API_PATHS.get(resourceType);
            var resourceName = RESOURCE_NAMES.get(resourceType);
            var url = config.getMasterUrl() + apiPath + "/namespaces/" + namespace + "/" + resourceName;

            try (var client = new KubernetesClientBuilder().withConfig(config).build()) {
                var httpClient = client.getHttpClient();
                var request = httpClient.newHttpRequestBuilder()
                        .uri(url)
                        .header("Accept", "application/json;as=Table;g=meta.k8s.io;v=v1")
                        .build();
                var response = httpClient.sendAsync(request, byte[].class).get();

                if (response.code() != 200) {
                    return new ResourceTable(resourceType, List.of(), List.of());
                }

                return parseTableResponse(resourceType, response.body());
            }
        } catch (Exception e) {
            return new ResourceTable(resourceType, List.of(), List.of());
        }
    }

    public String getResource(String contextName, String namespace, String resourceType, String name) {
        try {
            var config = Config.autoConfigure(contextName);
            config.setConnectionTimeout(TIMEOUT_MS);
            config.setRequestTimeout(TIMEOUT_MS);

            var apiPath = RESOURCE_API_PATHS.get(resourceType);
            var resourceName = RESOURCE_NAMES.get(resourceType);
            var url = config.getMasterUrl() + apiPath + "/namespaces/" + namespace + "/" + resourceName + "/" + name;

            try (var client = new KubernetesClientBuilder().withConfig(config).build()) {
                var httpClient = client.getHttpClient();
                var request = httpClient.newHttpRequestBuilder()
                        .uri(url)
                        .header("Accept", "application/json")
                        .build();
                var response = httpClient.sendAsync(request, byte[].class).get();

                if (response.code() != 200) {
                    return null;
                }

                return new String(response.body());
            }
        } catch (Exception e) {
            return null;
        }
    }

    private ResourceTable parseTableResponse(String resourceType, byte[] body) throws Exception {
        var root = MAPPER.readTree(body);

        var columns = new ArrayList<String>();
        var columnDefs = root.path("columnDefinitions");
        for (var col : columnDefs) {
            columns.add(col.path("name").asText());
        }

        var items = new ArrayList<ResourceTable.ResourceRow>();
        var rows = root.path("rows");
        for (var row : rows) {
            var cells = new ArrayList<String>();
            for (var cell : row.path("cells")) {
                cells.add(cell.isNull() ? "" : cell.asText());
            }

            var obj = row.path("object").path("metadata");
            var rowName = obj.path("name").asText("");
            var ns = obj.path("namespace").asText("");
            var ts = obj.path("creationTimestamp").asText("");

            items.add(new ResourceTable.ResourceRow(rowName, ns, cells, ts));
        }

        return new ResourceTable(resourceType, columns, items);
    }
}
