package com.goldscale.service;

import com.goldscale.exception.BusinessRuleException;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.io.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class BackupService {

    private static final List<String> COLLECTIONS = List.of(
            "accounts", "categories", "transactions", "tags", "settings"
    );

    private final MongoTemplate mongoTemplate;

    public void export(OutputStream outputStream) throws IOException {
        try (var zip = new ZipOutputStream(outputStream)) {
            var counts = new LinkedHashMap<String, Integer>();

            for (var collection : COLLECTIONS) {
                var docs = mongoTemplate.getCollection(collection).find().into(new ArrayList<>());
                counts.put(collection, docs.size());

                zip.putNextEntry(new ZipEntry(collection + ".json"));
                zip.write("[\n".getBytes());
                for (int i = 0; i < docs.size(); i++) {
                    if (i > 0) zip.write(",\n".getBytes());
                    zip.write(docs.get(i).toJson().getBytes());
                }
                zip.write("\n]".getBytes());
                zip.closeEntry();
            }

            // metadata
            var metadata = new Document();
            metadata.put("backupTimestamp", Instant.now().toString());
            metadata.put("collections", counts);

            zip.putNextEntry(new ZipEntry("metadata.json"));
            zip.write(metadata.toJson().getBytes());
            zip.closeEntry();
        }
    }

    public Map<String, Integer> restore(InputStream inputStream) throws IOException {
        // Parse zip into memory first to validate before dropping anything
        var collectionData = new LinkedHashMap<String, List<Document>>();

        try (var zip = new ZipInputStream(inputStream)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                var name = entry.getName();
                if (name.equals("metadata.json")) continue;
                if (!name.endsWith(".json")) continue;

                var collectionName = name.replace(".json", "");
                if (!COLLECTIONS.contains(collectionName)) continue;

                var content = new String(zip.readAllBytes());
                var docs = parseJsonArray(content);
                collectionData.put(collectionName, docs);
            }
        }

        if (collectionData.isEmpty()) {
            throw new BusinessRuleException("Invalid backup file: no valid collections found");
        }

        // Drop and restore each collection
        var counts = new LinkedHashMap<String, Integer>();

        for (var collection : COLLECTIONS) {
            // Always clear the collection
            mongoTemplate.getCollection(collection).deleteMany(new Document());

            var docs = collectionData.get(collection);
            if (docs != null && !docs.isEmpty()) {
                mongoTemplate.getCollection(collection).insertMany(docs);
                counts.put(collection, docs.size());
            } else {
                counts.put(collection, 0);
            }
        }

        return counts;
    }

    private List<Document> parseJsonArray(String json) {
        var docs = new ArrayList<Document>();
        // Use MongoDB's Document.parse for each element
        json = json.trim();
        if (!json.startsWith("[") || !json.endsWith("]")) {
            throw new BusinessRuleException("Invalid JSON array in backup file");
        }

        // Remove outer brackets
        json = json.substring(1, json.length() - 1).trim();
        if (json.isEmpty()) return docs;

        // Split by top-level commas between objects
        int depth = 0;
        int start = 0;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') depth--;
            else if (c == ',' && depth == 0) {
                var element = json.substring(start, i).trim();
                if (!element.isEmpty()) docs.add(Document.parse(element));
                start = i + 1;
            }
        }
        // Last element
        var last = json.substring(start).trim();
        if (!last.isEmpty()) docs.add(Document.parse(last));

        return docs;
    }
}
