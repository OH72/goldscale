package com.goldscale.service;

import com.goldscale.config.TestcontainersConfig;
import com.goldscale.dto.request.*;
import com.goldscale.exception.BusinessRuleException;
import com.goldscale.model.Currency;
import com.goldscale.model.DebtType;
import com.goldscale.repository.DebtRecordRepository;
import com.goldscale.repository.PersonRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfig.class)
class PersonServiceIT {

    @Autowired private PersonService personService;
    @Autowired private DebtRecordService debtRecordService;
    @Autowired private PersonRepository personRepository;
    @Autowired private DebtRecordRepository debtRecordRepository;

    @BeforeEach
    void cleanUp() {
        debtRecordRepository.deleteAll();
        personRepository.deleteAll();
    }

    @Test
    void should_createAndFindPerson() {
        var person = personService.create(new CreatePersonRequest("Alice"));

        var found = personService.findById(person.getId());

        assertThat(found.getName()).isEqualTo("Alice");
        assertThat(found.getCreatedAt()).isNotNull();
    }

    @Test
    void should_rejectDuplicateName() {
        personService.create(new CreatePersonRequest("Alice"));

        assertThatThrownBy(() -> personService.create(new CreatePersonRequest("Alice")))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void should_updatePerson() {
        var person = personService.create(new CreatePersonRequest("Alice"));

        var updated = personService.update(person.getId(), new UpdatePersonRequest("Bob"));

        assertThat(updated.getName()).isEqualTo("Bob");
    }

    @Test
    void should_deletePersonWithNoRecords() {
        var person = personService.create(new CreatePersonRequest("Alice"));

        personService.delete(person.getId());

        assertThat(personRepository.findById(person.getId())).isEmpty();
    }

    @Test
    void should_rejectDeletePersonWithOpenRecords() {
        var person = personService.create(new CreatePersonRequest("Alice"));

        debtRecordService.create(new CreateDebtRecordRequest(
                person.getId(), DebtType.DEBT, 100000L, Currency.UAH,
                null, "test debt", LocalDate.now()));

        assertThatThrownBy(() -> personService.delete(person.getId()))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("open debt records");
    }
}
