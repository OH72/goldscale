package com.goldscale.service;

import com.goldscale.dto.request.CreatePersonRequest;
import com.goldscale.dto.request.UpdatePersonRequest;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.exception.ResourceNotFoundException;
import com.goldscale.model.DebtStatus;
import com.goldscale.model.Person;
import com.goldscale.repository.DebtRecordRepository;
import com.goldscale.repository.PersonRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PersonServiceTest {

    @Mock private PersonRepository personRepository;
    @Mock private DebtRecordRepository debtRecordRepository;
    @Mock private DebtRecordService debtRecordService;

    @InjectMocks private PersonService personService;

    @Test
    void should_returnAllPeople_when_findAll() {
        var person1 = new Person();
        person1.setId("p1");
        person1.setName("Alice");
        var person2 = new Person();
        person2.setId("p2");
        person2.setName("Bob");

        when(personRepository.findAll(any(Sort.class))).thenReturn(List.of(person1, person2));

        var result = personService.findAll();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getName()).isEqualTo("Alice");
    }

    @Test
    void should_sortPeopleByNetDescending_when_findAllWithSummary() {
        var alice = new Person();
        alice.setId("p1");
        alice.setName("Alice");
        var bob = new Person();
        bob.setId("p2");
        bob.setName("Bob");
        var carol = new Person();
        carol.setId("p3");
        carol.setName("Carol");

        when(personRepository.findAll(any(Sort.class))).thenReturn(List.of(alice, bob, carol));
        when(debtRecordService.getSummaryByPerson()).thenReturn(java.util.Map.of(
                "p1", new com.goldscale.dto.response.DebtSummaryEntry("p1", "Alice", 500, 0, -500),
                "p2", new com.goldscale.dto.response.DebtSummaryEntry("p2", "Bob", 0, 900, 900)));

        var result = personService.findAllWithSummary(
                com.goldscale.model.PersonSortField.NET, Sort.Direction.DESC);

        assertThat(result).extracting(com.goldscale.dto.response.PersonResponse::name)
                .containsExactly("Bob", "Carol", "Alice");
        assertThat(result.get(0).totalLoan()).isEqualTo(900);
        assertThat(result.get(1).net()).isZero();
    }

    @Test
    void should_sortPeopleByNameAscending_when_findAllWithSummary() {
        var bob = new Person();
        bob.setId("p2");
        bob.setName("bob");
        var alice = new Person();
        alice.setId("p1");
        alice.setName("Alice");

        when(personRepository.findAll(any(Sort.class))).thenReturn(List.of(bob, alice));
        when(debtRecordService.getSummaryByPerson()).thenReturn(java.util.Map.of());

        var result = personService.findAllWithSummary(
                com.goldscale.model.PersonSortField.NAME, Sort.Direction.ASC);

        assertThat(result).extracting(com.goldscale.dto.response.PersonResponse::name)
                .containsExactly("Alice", "bob");
    }

    @Test
    void should_createPerson_when_validName() {
        var request = new CreatePersonRequest("Alice");
        var saved = new Person();
        saved.setId("p1");
        saved.setName("Alice");

        when(personRepository.existsByName("Alice")).thenReturn(false);
        when(personRepository.save(any())).thenReturn(saved);

        var result = personService.create(request);

        assertThat(result.getName()).isEqualTo("Alice");
        verify(personRepository).save(any());
    }

    @Test
    void should_throwBusinessRule_when_duplicateName() {
        var request = new CreatePersonRequest("Alice");
        when(personRepository.existsByName("Alice")).thenReturn(true);

        assertThatThrownBy(() -> personService.create(request))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void should_updatePerson_when_validName() {
        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(personRepository.findById("p1")).thenReturn(Optional.of(person));
        when(personRepository.existsByName("Bob")).thenReturn(false);
        when(personRepository.save(any())).thenReturn(person);

        var result = personService.update("p1", new UpdatePersonRequest("Bob"));

        assertThat(result.getName()).isEqualTo("Bob");
    }

    @Test
    void should_throwBusinessRule_when_updateDuplicateName() {
        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(personRepository.findById("p1")).thenReturn(Optional.of(person));
        when(personRepository.existsByName("Bob")).thenReturn(true);

        assertThatThrownBy(() -> personService.update("p1", new UpdatePersonRequest("Bob")))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void should_deletePerson_when_noOpenRecords() {
        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(personRepository.findById("p1")).thenReturn(Optional.of(person));
        when(debtRecordRepository.existsByPersonIdAndStatusAndDeletedFalse("p1", DebtStatus.OPEN))
                .thenReturn(false);

        personService.delete("p1");

        verify(personRepository).delete(person);
    }

    @Test
    void should_throwBusinessRule_when_deletePersonWithOpenRecords() {
        var person = new Person();
        person.setId("p1");
        person.setName("Alice");

        when(personRepository.findById("p1")).thenReturn(Optional.of(person));
        when(debtRecordRepository.existsByPersonIdAndStatusAndDeletedFalse("p1", DebtStatus.OPEN))
                .thenReturn(true);

        assertThatThrownBy(() -> personService.delete("p1"))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("open debt records");
    }
}
