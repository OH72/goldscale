package com.goldscale.service;

import com.goldscale.dto.request.CreatePersonRequest;
import com.goldscale.dto.request.UpdatePersonRequest;
import com.goldscale.dto.response.PersonResponse;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.DebtStatus;
import com.goldscale.model.Person;
import com.goldscale.model.PersonSortField;
import com.goldscale.repository.DebtRecordRepository;
import com.goldscale.repository.PersonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PersonService {

    private final PersonRepository personRepository;
    private final DebtRecordRepository debtRecordRepository;
    private final DebtRecordService debtRecordService;
    private final DebtOffsetService debtOffsetService;

    public List<Person> findAll() {
        return personRepository.findAll(Sort.by(Sort.Direction.ASC, "name"));
    }

    public List<PersonResponse> findAllWithSummary(PersonSortField sortBy, Sort.Direction direction) {
        var summaries = debtRecordService.getSummaryByPerson();
        var offsetPersonIds = debtOffsetService.personIdsWithOffset();
        var comparator = switch (sortBy) {
            case NAME -> Comparator.comparing(PersonResponse::name, String.CASE_INSENSITIVE_ORDER);
            case TOTAL_DEBT -> Comparator.comparingLong(PersonResponse::totalDebt);
            case TOTAL_LOAN -> Comparator.comparingLong(PersonResponse::totalLoan);
            case NET -> Comparator.comparingLong(PersonResponse::net);
        };
        if (direction == Sort.Direction.DESC) {
            comparator = comparator.reversed();
        }
        // Tie-break by name so ordering is stable
        comparator = comparator.thenComparing(PersonResponse::name, String.CASE_INSENSITIVE_ORDER);

        return findAll().stream()
                .map(p -> PersonResponse.from(p, summaries.get(p.getId()), offsetPersonIds.contains(p.getId())))
                .sorted(comparator)
                .toList();
    }

    public Person findById(String id) {
        return personRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Person", id));
    }

    public Person create(CreatePersonRequest request) {
        var trimmed = request.name().trim();
        if (personRepository.existsByName(trimmed)) {
            throw new BusinessRuleException("Person '" + trimmed + "' already exists");
        }

        var person = new Person();
        person.setName(trimmed);
        person.setUpdatedAt(Instant.now());
        return personRepository.save(person);
    }

    public Person update(String id, UpdatePersonRequest request) {
        var person = findById(id);
        var trimmed = request.name().trim();

        if (!person.getName().equals(trimmed) && personRepository.existsByName(trimmed)) {
            throw new BusinessRuleException("Person '" + trimmed + "' already exists");
        }

        person.setName(trimmed);
        person.setUpdatedAt(Instant.now());
        return personRepository.save(person);
    }

    public void delete(String id) {
        var person = findById(id);

        if (debtRecordRepository.existsByPersonIdAndStatusAndDeletedFalse(id, DebtStatus.OPEN)) {
            throw new BusinessRuleException(
                    "Cannot delete person '" + person.getName() + "': has open debt records");
        }

        personRepository.delete(person);
    }
}
