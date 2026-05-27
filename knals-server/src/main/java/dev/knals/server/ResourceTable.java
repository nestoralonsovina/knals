package dev.knals.server;

import java.util.List;

public record ResourceTable(
    String kind,
    List<String> columns,
    List<ResourceRow> items
) {
    public record ResourceRow(
        String name,
        String namespace,
        List<String> cells,
        String creationTimestamp
    ) {}
}
