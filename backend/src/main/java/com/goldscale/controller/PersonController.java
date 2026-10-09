package com.goldscale.controller;

import com.goldscale.dto.request.CreatePersonRequest;
import com.goldscale.dto.request.UpdatePersonRequest;
import com.goldscale.dto.response.PersonResponse;
import com.goldscale.model.PersonSortField;
import com.goldscale.service.PersonService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/people")
@RequiredArgsConstructor
public class PersonController {

    private final PersonService personService;

    @GetMapping
    public ResponseEntity<List<PersonResponse>> findAll(
            @RequestParam(defaultValue = "NAME") PersonSortField sortBy,
            @RequestParam(defaultValue = "ASC") Sort.Direction direction) {
        return ResponseEntity.ok(personService.findAllWithSummary(sortBy, direction));
    }

    @PostMapping
    public ResponseEntity<PersonResponse> create(@Valid @RequestBody CreatePersonRequest request) {
        var person = personService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(PersonResponse.from(person));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PersonResponse> update(
            @PathVariable String id,
            @Valid @RequestBody UpdatePersonRequest request) {
        var person = personService.update(id, request);
        return ResponseEntity.ok(PersonResponse.from(person));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        personService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
