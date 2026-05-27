package dev.knals.server;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

@ApplicationScoped
public class NamespaceMemoryStore {

    private static final String FILE_NAME = "namespaces.json";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, List<String>>> TYPE_REF = new TypeReference<>() {};

    private final Path filePath;

    public NamespaceMemoryStore(
            @ConfigProperty(name = "knals.config.dir", defaultValue = "${user.home}/.config/knals") String configDir) {
        this.filePath = Path.of(configDir).resolve(FILE_NAME);
    }

    public List<String> list(String clusterContext) {
        var data = load();
        return data.getOrDefault(clusterContext, List.of());
    }

    public void add(String clusterContext, String namespace) {
        var data = load();
        var namespaces = data.computeIfAbsent(clusterContext, k -> new ArrayList<>());
        if (!namespaces.contains(namespace)) {
            namespaces.add(namespace);
            save(data);
        }
    }

    public List<String> addAll(String clusterContext, List<String> namespaces) {
        var data = load();
        var existing = data.computeIfAbsent(clusterContext, k -> new ArrayList<>());
        var added = new ArrayList<String>();
        for (var ns : namespaces) {
            if (!existing.contains(ns)) {
                existing.add(ns);
                added.add(ns);
            }
        }
        if (!added.isEmpty()) {
            save(data);
        }
        return added;
    }

    public boolean remove(String clusterContext, String namespace) {
        var data = load();
        var namespaces = data.get(clusterContext);
        if (namespaces == null || !namespaces.remove(namespace)) {
            return false;
        }
        if (namespaces.isEmpty()) {
            data.remove(clusterContext);
        }
        save(data);
        return true;
    }

    private Map<String, List<String>> load() {
        if (!Files.exists(filePath)) {
            return new LinkedHashMap<>();
        }
        try {
            return MAPPER.readValue(filePath.toFile(), TYPE_REF);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void save(Map<String, List<String>> data) {
        try {
            Files.createDirectories(filePath.getParent());
            MAPPER.writerWithDefaultPrettyPrinter().writeValue(filePath.toFile(), data);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
