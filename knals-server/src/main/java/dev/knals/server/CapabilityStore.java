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
public class CapabilityStore {

    private static final String FILE_NAME = "capabilities.json";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Map<String, List<String>>>> TYPE_REF = new TypeReference<>() {};

    private final Path filePath;

    public CapabilityStore(
            @ConfigProperty(name = "knals.config.dir", defaultValue = "${user.home}/.config/knals") String configDir) {
        this.filePath = Path.of(configDir).resolve(FILE_NAME);
    }

    public Map<String, List<String>> get(String clusterContext, String namespace) {
        var data = load();
        return data.getOrDefault(key(clusterContext, namespace), null);
    }

    public void put(String clusterContext, String namespace, Map<String, List<String>> snapshot) {
        var data = load();
        data.put(key(clusterContext, namespace), snapshot);
        save(data);
    }

    private String key(String clusterContext, String namespace) {
        return clusterContext + ":" + namespace;
    }

    private Map<String, Map<String, List<String>>> load() {
        if (!Files.exists(filePath)) {
            return new LinkedHashMap<>();
        }
        try {
            return MAPPER.readValue(filePath.toFile(), TYPE_REF);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void save(Map<String, Map<String, List<String>>> data) {
        try {
            Files.createDirectories(filePath.getParent());
            MAPPER.writerWithDefaultPrettyPrinter().writeValue(filePath.toFile(), data);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
