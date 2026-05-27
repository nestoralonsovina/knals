package dev.knals.server;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.fabric8.kubernetes.client.Config;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import io.fabric8.kubernetes.client.KubernetesClientException;
import jakarta.enterprise.context.ApplicationScoped;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class KubernetesService {

    private static final int TIMEOUT_MS = 5000;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static boolean isValidResourceType(String type) {
        return ResourceTypeInfo.isValid(type);
    }

    public KubeResult<List<String>> listNamespaces(String contextName) {
        try {
            try (var client = buildClient(contextName)) {
                var names = client.namespaces().list().getItems().stream()
                        .map(ns -> ns.getMetadata().getName())
                        .toList();
                return new KubeResult.Success<>(names);
            }
        } catch (Exception e) {
            return classifyError(e);
        }
    }

    public KubeResult<Boolean> namespaceExists(String contextName, String namespace) {
        try {
            try (var client = buildClient(contextName)) {
                var ns = client.namespaces().withName(namespace).get();
                return new KubeResult.Success<>(ns != null);
            }
        } catch (Exception e) {
            return classifyError(e);
        }
    }

    public KubeResult<ResourceTable> listResources(String contextName, String namespace, String resourceType) {
        try {
            var config = buildConfig(contextName);
            var typeInfo = ResourceTypeInfo.find(resourceType);
            var masterUrl = config.getMasterUrl().replaceAll("/$", "");
            var url = masterUrl + typeInfo.apiPath() + "/namespaces/" + namespace + "/" + typeInfo.plural();

            try (var client = new KubernetesClientBuilder().withConfig(config).build()) {
                var httpClient = client.getHttpClient();
                var request = httpClient.newHttpRequestBuilder()
                        .uri(url)
                        .header("Accept", "application/json;as=Table;g=meta.k8s.io;v=v1")
                        .build();
                var response = httpClient.sendAsync(request, byte[].class).get();

                if (response.code() == 403) {
                    return new KubeResult.Forbidden<>("Cannot list " + resourceType + " in " + namespace);
                }
                if (response.code() == 404) {
                    return new KubeResult.NotFound<>(resourceType + " in " + namespace);
                }
                if (response.code() != 200) {
                    return new KubeResult.Unreachable<>("HTTP " + response.code());
                }

                return new KubeResult.Success<>(parseTableResponse(resourceType, response.body()));
            }
        } catch (Exception e) {
            return classifyError(e);
        }
    }

    public KubeResult<String> getResource(String contextName, String namespace, String resourceType, String name) {
        try {
            var config = buildConfig(contextName);
            var typeInfo = ResourceTypeInfo.find(resourceType);
            var masterUrl = config.getMasterUrl().replaceAll("/$", "");
            var url = masterUrl + typeInfo.apiPath() + "/namespaces/" + namespace + "/" + typeInfo.plural() + "/" + name;

            try (var client = new KubernetesClientBuilder().withConfig(config).build()) {
                var httpClient = client.getHttpClient();
                var request = httpClient.newHttpRequestBuilder()
                        .uri(url)
                        .header("Accept", "application/json")
                        .build();
                var response = httpClient.sendAsync(request, byte[].class).get();

                if (response.code() == 403) {
                    return new KubeResult.Forbidden<>("Cannot get " + resourceType + "/" + name);
                }
                if (response.code() == 404) {
                    return new KubeResult.NotFound<>(resourceType + "/" + name);
                }
                if (response.code() != 200) {
                    return new KubeResult.Unreachable<>("HTTP " + response.code());
                }

                return new KubeResult.Success<>(new String(response.body()));
            }
        } catch (Exception e) {
            return classifyError(e);
        }
    }

    private Config buildConfig(String contextName) {
        var config = Config.autoConfigure(contextName);
        config.setConnectionTimeout(TIMEOUT_MS);
        config.setRequestTimeout(TIMEOUT_MS);
        return config;
    }

    private KubernetesClient buildClient(String contextName) {
        return new KubernetesClientBuilder().withConfig(buildConfig(contextName)).build();
    }

    private <T> KubeResult<T> classifyError(Exception e) {
        var root = rootCause(e);
        if (root instanceof KubernetesClientException kce) {
            if (kce.getCode() == 403) return new KubeResult.Forbidden<>(kce.getMessage());
            if (kce.getCode() == 404) return new KubeResult.NotFound<>(kce.getMessage());
        }
        if (root instanceof ConnectException || root instanceof SocketTimeoutException) {
            return new KubeResult.Unreachable<>(root.getMessage());
        }
        if (e.getMessage() != null && e.getMessage().contains("context")) {
            return new KubeResult.NotFound<>(e.getMessage());
        }
        return new KubeResult.Unreachable<>(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
    }

    private Throwable rootCause(Throwable t) {
        while (t.getCause() != null && t.getCause() != t) t = t.getCause();
        return t;
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
