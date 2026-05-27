package dev.knals.server;

import java.util.List;

public record ResourceTypeInfo(
    String name,
    String plural,
    String apiPath
) {
    private static final List<ResourceTypeInfo> REGISTRY = List.of(
            new ResourceTypeInfo("pods", "pods", "/api/v1"),
            new ResourceTypeInfo("deployments", "deployments", "/apis/apps/v1"),
            new ResourceTypeInfo("replicasets", "replicasets", "/apis/apps/v1"),
            new ResourceTypeInfo("statefulsets", "statefulsets", "/apis/apps/v1"),
            new ResourceTypeInfo("daemonsets", "daemonsets", "/apis/apps/v1"),
            new ResourceTypeInfo("jobs", "jobs", "/apis/batch/v1"),
            new ResourceTypeInfo("cronjobs", "cronjobs", "/apis/batch/v1"),
            new ResourceTypeInfo("services", "services", "/api/v1"),
            new ResourceTypeInfo("ingresses", "ingresses", "/apis/networking.k8s.io/v1"),
            new ResourceTypeInfo("configmaps", "configmaps", "/api/v1"),
            new ResourceTypeInfo("secrets", "secrets", "/api/v1"),
            new ResourceTypeInfo("pvcs", "persistentvolumeclaims", "/api/v1"),
            new ResourceTypeInfo("serviceaccounts", "serviceaccounts", "/api/v1"),
            new ResourceTypeInfo("events", "events", "/api/v1")
    );

    public static List<ResourceTypeInfo> all() {
        return REGISTRY;
    }

    public static ResourceTypeInfo find(String name) {
        return REGISTRY.stream()
                .filter(r -> r.name().equals(name))
                .findFirst()
                .orElse(null);
    }

    public static boolean isValid(String name) {
        return find(name) != null;
    }

    public String group() {
        if (apiPath.equals("/api/v1")) return "";
        return apiPath.replaceFirst("^/apis/", "").replaceFirst("/v[0-9]+.*$", "");
    }
}
