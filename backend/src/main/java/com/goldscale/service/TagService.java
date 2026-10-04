package com.goldscale.service;

import com.goldscale.dto.request.CreateTagRequest;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.Tag;
import com.goldscale.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TagService {

    private final TagRepository tagRepository;

    public List<Tag> findAll() {
        return tagRepository.findAll();
    }

    public Tag findById(String id) {
        return tagRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tag", id));
    }

    public Tag create(CreateTagRequest request) {
        var trimmed = request.name().trim();
        if (tagRepository.existsByName(trimmed)) {
            throw new BusinessRuleException("Tag '" + trimmed + "' already exists");
        }

        var tag = new Tag();
        tag.setName(trimmed);
        return tagRepository.save(tag);
    }

    public void delete(String id) {
        var tag = findById(id);
        tagRepository.delete(tag);
    }

    /**
     * Resolve tag names to tag IDs. Creates tags that don't exist yet.
     * Returns list of tag IDs in the same order as input names.
     */
    public List<String> resolveTagNames(List<String> names) {
        if (names == null || names.isEmpty()) {
            return List.of();
        }

        var trimmedNames = names.stream()
                .map(String::trim)
                .filter(n -> !n.isEmpty())
                .distinct()
                .toList();

        if (trimmedNames.isEmpty()) {
            return List.of();
        }

        var existing = tagRepository.findByNameIn(trimmedNames);
        var existingByName = existing.stream()
                .collect(Collectors.toMap(Tag::getName, Tag::getId));

        var result = new ArrayList<String>();
        for (var name : trimmedNames) {
            var tagId = existingByName.get(name);
            if (tagId != null) {
                result.add(tagId);
            } else {
                var tag = new Tag();
                tag.setName(name);
                tag = tagRepository.save(tag);
                result.add(tag.getId());
            }
        }

        return result;
    }

    /**
     * Get a map of tag ID -> tag name for display purposes.
     */
    public Map<String, String> getTagNamesByIds(List<String> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return Map.of();
        }

        return tagRepository.findAllById(tagIds).stream()
                .collect(Collectors.toMap(Tag::getId, Tag::getName));
    }
}
