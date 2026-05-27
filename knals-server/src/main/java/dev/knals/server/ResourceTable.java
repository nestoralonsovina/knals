package dev.knals.server;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
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

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static ResourceTable fromTableApiResponse(String resourceType, byte[] body) throws Exception {
        var root = MAPPER.readTree(body);

        var columns = new ArrayList<String>();
        for (var col : root.path("columnDefinitions")) {
            columns.add(col.path("name").asText());
        }

        var items = new ArrayList<ResourceRow>();
        for (var row : root.path("rows")) {
            var cells = new ArrayList<String>();
            for (var cell : row.path("cells")) {
                cells.add(cell.isNull() ? "" : cell.asText());
            }
            var obj = row.path("object").path("metadata");
            items.add(new ResourceRow(
                    obj.path("name").asText(""),
                    obj.path("namespace").asText(""),
                    cells,
                    obj.path("creationTimestamp").asText("")
            ));
        }

        return new ResourceTable(resourceType, columns, items);
    }
}
