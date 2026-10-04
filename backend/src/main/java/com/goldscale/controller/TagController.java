package com.goldscale.controller;

import com.goldscale.dto.request.CreateTagRequest;
import com.goldscale.dto.response.TagResponse;
import com.goldscale.service.TagService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    @GetMapping
    public ResponseEntity<List<TagResponse>> findAll() {
        var tags = tagService.findAll().stream()
                .map(TagResponse::from)
                .toList();
        return ResponseEntity.ok(tags);
    }

    @PostMapping
    public ResponseEntity<TagResponse> create(@Valid @RequestBody CreateTagRequest request) {
        var tag = tagService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(TagResponse.from(tag));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        tagService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
