package dev.knals.server;

import io.fabric8.kubernetes.api.model.authorization.v1.SelfSubjectRulesReviewBuilder;
import io.fabric8.kubernetes.client.Config;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import io.fabric8.kubernetes.client.KubernetesClientException;
import io.fabric8.kubernetes.client.http.HttpResponse;
import jakarta.enterprise.context.ApplicationScoped;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.*;

@ApplicationScoped
public class KubernetesService {

    private static final int TIMEOUT_MS = 5000;

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
            return classifyError(e, contextName);
        }
    }

    public KubeResult<Boolean> namespaceExists(String contextName, String namespace) {
        try {
            try (var client = buildClient(contextName)) {
                var ns = client.namespaces().withName(namespace).get();
                return new KubeResult.Success<>(ns != null);
            }
        } catch (Exception e) {
            return classifyError(e, contextName);
        }
    }

    public KubeResult<ResourceTable> listResources(String contextName, String namespace, String resourceType) {
        var typeInfo = ResourceTypeInfo.find(resourceType);
        var path = typeInfo.apiPath() + "/namespaces/" + namespace + "/" + typeInfo.plural();

        return rawGet(contextName, path, "application/json;as=Table;g=meta.k8s.io;v=v1",
                body -> ResourceTable.fromTableApiResponse(resourceType, body),
                "list " + resourceType + " in " + namespace);
    }

    public KubeResult<String> getResource(String contextName, String namespace, String resourceType, String name) {
        var typeInfo = ResourceTypeInfo.find(resourceType);
        var path = typeInfo.apiPath() + "/namespaces/" + namespace + "/" + typeInfo.plural() + "/" + name;

        return rawGet(contextName, path, "application/json",
                body -> new String(body),
                resourceType + "/" + name);
    }

    public KubeResult<Map<String, List<String>>> selfSubjectRulesReview(String contextName, String namespace) {
        try {
            try (var client = buildClient(contextName)) {
                var review = new SelfSubjectRulesReviewBuilder()
                        .withNewSpec().withNamespace(namespace).endSpec()
                        .build();
                var result = client.authorization().v1().selfSubjectRulesReview().create(review);
                var rules = result.getStatus().getResourceRules();

                Map<String, Set<String>> caps = new LinkedHashMap<>();

                for (var rule : rules) {
                    var resources = rule.getResources() != null ? rule.getResources() : List.<String>of();
                    var verbs = rule.getVerbs() != null ? rule.getVerbs() : List.<String>of();
                    var apiGroups = rule.getApiGroups() != null ? rule.getApiGroups() : List.<String>of();

                    for (var typeInfo : ResourceTypeInfo.all()) {
                        boolean groupMatch = apiGroups.contains("*") || apiGroups.contains(typeInfo.group());
                        boolean resourceMatch = resources.contains("*") || resources.contains(typeInfo.plural());
                        if (groupMatch && resourceMatch) {
                            var verbSet = caps.computeIfAbsent(typeInfo.name(), k -> new LinkedHashSet<>());
                            if (verbs.contains("*")) {
                                verbSet.addAll(List.of("get", "list", "watch", "create", "update", "patch", "delete"));
                            } else {
                                verbSet.addAll(verbs);
                            }
                        }
                    }
                }

                Map<String, List<String>> snapshot = new LinkedHashMap<>();
                for (var entry : caps.entrySet()) {
                    snapshot.put(entry.getKey(), new ArrayList<>(entry.getValue()));
                }
                return new KubeResult.Success<>(snapshot);
            }
        } catch (Exception e) {
            return classifyError(e, contextName);
        }
    }

    private <T> KubeResult<T> rawGet(String contextName, String path, String accept,
                                     ThrowingFunction<byte[], T> parser, String description) {
        try {
            var config = buildConfig(contextName);
            var masterUrl = config.getMasterUrl().replaceAll("/$", "");

            try (var client = new KubernetesClientBuilder().withConfig(config).build()) {
                var response = client.getHttpClient()
                        .sendAsync(
                                client.getHttpClient().newHttpRequestBuilder()
                                        .uri(masterUrl + path)
                                        .header("Accept", accept)
                                        .build(),
                                byte[].class
                        ).get();

                return mapResponse(response, parser, description);
            }
        } catch (Exception e) {
            return classifyError(e, contextName);
        }
    }

    private <T> KubeResult<T> mapResponse(HttpResponse<byte[]> response,
                                           ThrowingFunction<byte[], T> parser, String description) throws Exception {
        return switch (response.code()) {
            case 200 -> new KubeResult.Success<>(parser.apply(response.body()));
            case 403 -> new KubeResult.Forbidden<>("Cannot " + description);
            case 404 -> new KubeResult.NotFound<>(description);
            default -> new KubeResult.Unreachable<>("HTTP " + response.code());
        };
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

    private <T> KubeResult<T> classifyError(Exception e, String contextName) {
        var root = rootCause(e);
        if (root instanceof KubernetesClientException kce) {
            if (kce.getCode() == 403) return new KubeResult.Forbidden<>(kce.getMessage());
            if (kce.getCode() == 404) return new KubeResult.NotFound<>(kce.getMessage());
            return new KubeResult.Unreachable<>(kce.getMessage());
        }
        if (root instanceof ConnectException || root instanceof SocketTimeoutException) {
            return new KubeResult.Unreachable<>(root.getMessage());
        }
        if (root instanceof IllegalArgumentException) {
            return new KubeResult.ContextNotFound<>(contextName);
        }
        return new KubeResult.Unreachable<>(root.getMessage() != null ? root.getMessage() : root.getClass().getSimpleName());
    }

    private Throwable rootCause(Throwable t) {
        while (t.getCause() != null && t.getCause() != t) t = t.getCause();
        return t;
    }

    @FunctionalInterface
    interface ThrowingFunction<I, O> {
        O apply(I input) throws Exception;
    }
}
