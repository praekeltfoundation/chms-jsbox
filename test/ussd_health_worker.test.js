var vumigo = require('vumigo_v02');
var fixtures = require('./fixtures');
var assert = require('assert');
var AppTester = vumigo.AppTester;

describe("familyconnect health worker app", function() {
    describe("for ussd use - auth on", function() {
        var app;
        var tester;

        beforeEach(function() {
            app = new go.app.GoFC();
            tester = new AppTester(app);

            tester
                .setup.char_limit(182)
                .setup.config.app({
                    name: 'familyconnect',
                    country_code: '256',  // uganda
                    channel: '*120*8864*0000#',
                    testing_today: '2015-04-03',
                    metric_store: 'chms_uganda_test',  // _env at the end
                    services: {
                        identities: {
                            api_token: 'test_token_identities',
                            url: "http://localhost:8001/api/v1/"
                        },
                        subscriptions: {
                            api_token: 'test_token_subscriptions',
                            url: "http://localhost:8002/api/v1/"
                        }
                    },
                    no_timeout_redirects: [
                        'state_start',
                        'state_end_thank_you',
                    ],
                    control: {
                        username: "test_user",
                        api_key: "test_key",
                        url: "http://127.0.0.1:8000/subscription/"
                    },
                    endpoints: {
                        "sms": {"delivery_class": "sms"}
                    },
                })
                .setup(function(api) {
                    fixtures().forEach(api.http.fixtures.add);
                })
                .setup(function(api) {
                    api.metrics.stores = {'chms_uganda_test': {}};
                })
                ;
        });

        // TEST TIMEOUTS

        describe("Timeout testing", function() {
            it("should ask about continuing", function() {
                return tester
                    .setup.user.addr('0820000222')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , {session_event: 'close'}
                        , {session_event: 'new'}
                    )
                    .check.interaction({
                        state: 'state_timed_out',
                        reply: [
                            "You have an incomplete registration. Would you like to continue with this registration?",
                            "1. Yes",
                            "2. No, start new registration"
                        ].join('\n')
                    })
                    .run();
            });
            it("should continue", function() {
                return tester
                    .setup.user.addr('0820000222')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , {session_event: 'close'}
                        , {session_event: 'new'}
                        , '1'  // state_timed_out - continue
                    )
                    .check.interaction({
                        state: 'state_msg_receiver'
                    })
                    .run();
            });
            it("should restart", function() {
                return tester
                    .setup.user.addr('0820000222')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , {session_event: 'close'}
                        , {session_event: 'new'}
                        , '2'  // state_timed_out - restart
                    )
                    .check.interaction({
                        state: 'state_auth_code'
                    })
                    .run();
            });
        });

        // TEST HCP RECOGNISED USER

        describe("HCP recognised user", function() {
            it("should not be asked for personnel code", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                    )
                    .check.interaction({
                        state: 'state_msg_receiver'
                    })
                    .run();
            });
        });

        // TEST REGISTRATION

        describe("Flow testing", function() {
            it("to state_auth_code", function() {
                return tester
                    .setup.user.addr('0820000222')
                    .inputs(
                        {session_event: 'new'}  // dial in
                    )
                    .check.interaction({
                        state: 'state_auth_code',
                        reply: "Welcome to FamilyConnect. Please enter your unique personnel code. For example, 12345"
                    })
                    .run();
            });
            it("to state_msg_receiver", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                    )
                    .check.interaction({
                        state: 'state_msg_receiver',
                        reply: [
                            "Please select who will receive the messages on their phone:",
                            "1. Head of the Household",
                            "2. Mother to be",
                            "3. Family member",
                            "4. Trusted friend"
                        ].join('\n')
                    })
                    .run();
            });
            it("to state_msisdn", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                    )
                    .check.interaction({
                        state: 'state_msisdn',
                        reply: "Please enter the mobile number which the messages will be sent to. For example, 0803304899"
                    })
                    .run();
            });
            it("to state_msisdn_already_registered", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000444'  // state_msisdn
                    )
                    .check.interaction({
                        state: 'state_msisdn_already_registered',
                        reply: [
                            "0820000444 is already registered for messages.",
                            "1. Continue registration",
                            "2. Register a different number"
                        ].join('\n')
                    })
                    .run();
            });
            it("to state_household_head_name (registered msisdn with no subscriptions)", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000555'  // state_msisdn
                    )
                    .check.interaction({
                        state: 'state_household_head_name',
                        reply: "Please enter the first name of the Head of the Household. For example: Isaac."
                    })
                    .run();
            });
            it("to state_household_head_name (unregistered msisdn)", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                    )
                    .check.interaction({
                        state: 'state_household_head_name',
                        reply: "Please enter the first name of the Head of the Household. For example: Isaac."
                    })
                    .run();
            });
            it("to state_household_head_surname", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                    )
                    .check.interaction({
                        state: 'state_household_head_surname',
                        reply: "Please enter the surname of the Head of the Household. For example: Mbire."
                    })
                    .run();
            });
            it("to state_last_period_month", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                    )
                    .check.interaction({
                        state: 'state_last_period_month',
                        reply: [
                            "When did the woman have her last period:",
                            "1. Apr 15",
                            "2. Mar 15",
                            "3. Feb 15",
                            "4. Jan 15",
                            "5. Dec 14",
                            "6. Nov 14",
                            "7. Oct 14",
                            "8. Sep 14",
                            "9. Aug 14"
                        ].join('\n')
                    })
                    .run();
            });
            it("to state_last_period_day", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                    )
                    .check.interaction({
                        state: 'state_last_period_day',
                        reply: "What day of the month did the woman start her last period? For example, 12."
                    })
                    .run();
            });
            it("to state_mother_name", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                    )
                    .check.interaction({
                        state: 'state_mother_name',
                        reply: "Please enter the name of the woman. For example: Sharon"
                    })
                    .run();
            });
            it("to state_mother_surname", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Sharon'  // state_mother_name
                    )
                    .check.interaction({
                        state: 'state_mother_surname',
                        reply: "Please enter the surname of the woman. For example: Nalule"
                    })
                    .run();
            });
            it("to state_id_type", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Sharon'  // state_mother_name
                        , 'Nalule'  // state_mother_surname
                    )
                    .check.interaction({
                        state: 'state_id_type',
                        reply: [
                            "What kind of identification does the woman have?",
                            "1. Ugandan National Identity Number",
                            "2. Other"
                        ].join('\n')
                    })
                    .run();
            });

            it("to state_nin", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Sharon'  // state_mother_name
                        , 'Nalule'  // state_mother_surname
                        , '1'  // state_id_type - ugandan id
                    )
                    .check.interaction({
                        state: 'state_nin',
                        reply: "Please enter the woman's National Identity Number:"
                    })
                    .run();
            });
            it("to state_msg_language (NIN)", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Sharon'  // state_mother_name
                        , 'Nalule'  // state_mother_surname
                        , '1'  // state_id_type - ugandan id
                        , '444'  // state_nin
                    )
                    .check.interaction({
                        state: 'state_msg_language',
                        reply: [
                            "What language would they want to receive these messages in?",
                            "1. English",
                            "2. Runyakore",
                            "3. Lusoga",
                        ].join('\n')
                    })
                    .run();
            });

            it("to state_mother_birth_day", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Sharon'  // state_mother_name
                        , 'Nalule'  // state_mother_surname
                        , '2'  // state_id_type - other
                    )
                    .check.interaction({
                        state: 'state_mother_birth_day',
                        reply: "Please enter the day the woman was born. For example, 12."
                    })
                    .run();
            });
            it("to state_mother_birth_month", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Sharon'  // state_mother_name
                        , 'Nalule'  // state_mother_surname
                        , '2'  // state_id_type - other
                        , '13'  // state_mother_birth_day - 13th
                    )
                    .check.interaction({
                        state: 'state_mother_birth_month',
                        reply: [
                            "Please select the month of birth:",
                            "1. January",
                            "2. February",
                            "3. March",
                            "4. April",
                            "5. May",
                            "6. June",
                            "7. July",
                            "8. August",
                            "9. September",
                            "10. October",
                            "11. November",
                            "12. December"
                        ].join('\n')
                    })
                    .run();
            });
            it("to state_mother_birth_year", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Sharon'  // state_mother_name
                        , 'Nalule'  // state_mother_surname
                        , '2'  // state_id_type - other
                        , '13'  // state_mother_birth_day - 13th
                        , '5'  // state_mother_birth_month - may
                    )
                    .check.interaction({
                        state: 'state_mother_birth_year',
                        reply: "Please enter the year the mother was born. For example, 1986."
                    })
                    .run();
            });
            it("to state_msg_language (Other)", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Sharon'  // state_mother_name
                        , 'Nalule'  // state_mother_surname
                        , '2'  // state_id_type - other
                        , '13'  // state_mother_birth_day - 13th
                        , '5'  // state_mother_birth_month - may
                        , '1982'  // state_mother_birth_year - 1982
                    )
                    .check.interaction({
                        state: 'state_msg_language',
                        reply: [
                            "What language would they want to receive these messages in?",
                            "1. English",
                            "2. Runyakore",
                            "3. Lusoga",
                        ].join('\n')
                    })
                    .run();
            });

            it("to state_hiv_messages", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Sharon'  // state_mother_name
                        , 'Nalule'  // state_mother_surname
                        , '1'  // state_id_type - ugandan id
                        , '444'  // state_nin
                        , '3'  // state_msg_language - lusoga
                    )
                    .check.interaction({
                        state: 'state_hiv_messages',
                        reply: [
                            "Would they like to receive additional messages about HIV?",
                            "1. Yes",
                            "2. No"
                        ].join('\n')
                    })
                    .run();
            });

            it("complete flow - uganda ID, english, hiv messages", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - july 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Sharon'  // state_mother_name
                        , 'Nalule'  // state_mother_surname
                        , '1'  // state_id_type - ugandan id
                        , '444'  // state_nin
                        , '3'  // state_msg_language - lusoga
                        , '1'  // state_hiv_messages - yes
                    )
                    .check.interaction({
                        state: 'state_end_thank_you',
                        reply: "Thank you. The woman's FamilyConnect ID is 1234567890. They will now start receiving messages"
                    })
                    .run();
            });
            it("complete flow - mother, other ID, lusoga, no hiv msgs", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '2'  // state_msg_receiver - mother to be
                        , '0820000333'  // state_msisdn
                        , 'Isaac'  // state_household_head_name
                        , 'Mbire'  // state_household_head_surname
                        , '1'  // state_last_period_month - July 2015
                        , '21'  // state_last_period_day - 21st
                        , 'Mary'  // state_mother_name
                        , 'Nalule'  // state_mother_surname
                        , '2'  // state_id_type - other ID
                        , '13'  // state_mother_birth_day - 13th
                        , '5'  // state_mother_birth_month - may
                        , '1982'  // state_mother_birth_year - 1982
                        , '3'  // state_msg_language - lusoga
                        , '2'  // state_hiv_messages - no
                    )
                    .check.interaction({
                        state: 'state_end_thank_you',
                        reply: "Thank you. The woman's FamilyConnect ID is 1234567890. They will now start receiving messages"
                    })
                    .run();
            });
        });

        // TEST VALIDATION

        describe("Validation testing", function() {
            it("validate state_auth_code", function() {
                return tester
                    .setup.user.addr('0820000222')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , 'aaaaa'  // state_auth_code - invalid personnel code
                    )
                    .check.interaction({
                        state: 'state_auth_code',
                        reply: "That code is not recognised. Please enter your 5 digit personnel code."
                    })
                    .run();
            });
            it("validate state_msg_receiver", function() {
                return tester
                    .setup.user.addr('0820000222')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '5'  // state_msg_receiver - invalid choice
                    )
                    .check.interaction({
                        state: 'state_msg_receiver',
                        reply: [
                            "Sorry not a valid input. Please select who will receive the messages on their phone:",
                            "1. Head of the Household",
                            "2. Mother to be",
                            "3. Family member",
                            "4. Trusted friend"
                        ].join('\n')
                    })
                    .run();
            });
            it("validate state_household_head_name", function() {
                return tester
                    .setup.user.addr('0820000111')
                    .inputs(
                        {session_event: 'new'}  // dial in
                        , '12345'  // state_auth_code - personnel code
                        , '1'  // state_msg_receiver - head of household
                        , '0820000333'  // state_msisdn
                        , 'Isaac1'  // state_household_head_name
                    )
                    .check.interaction({
                        state: 'state_household_head_name',
                        reply: "Sorry not a valid input. Please enter the first name of the Head of the Household. For example: Isaac."
                    })
                    .run();
            });
        });

        // TEST UTILS FUNCTIONS

        describe("utils function testing", function() {
            describe("is_valid_year", function() {
                it('should return true/false if year is valid', function() {
                    // test data
                    var testDataArray = [
                        ['12345', '1900', '2016'],  // invalid year parameter (length>4)
                        ['2000', '1999', '2016'],  // valid - year parameter within min/max range
                        ['2017', '1900', '2016'],  // year parameter outside max
                        ['20a4', '1900', '2016'],  // invalid year parameter (alpha in string)
                        ['2005', '1900', 'bbbb'],  // invalid max parameter (alpha)
                        ['1981', '1950', '2016'],  // valid - year parameter within min/max range
                        ['1981', '19501', '2016']  // invalid min parameter (length>4)
                    ];

                    // function call
                    var resultsArray = [];
                    for (var i=0; i<testDataArray.length; i++) {
                        resultsArray.push(go.utils.is_valid_year(testDataArray[i][0], testDataArray[i][1], testDataArray[i][2]));
                    }

                    // expected results
                    assert.equal(resultsArray.length, 7);
                    assert.equal(resultsArray[0], false);
                    assert.equal(resultsArray[1], true);
                    assert.equal(resultsArray[2], false);
                    assert.equal(resultsArray[3], false);
                    assert.equal(resultsArray[4], false);
                    assert.equal(resultsArray[5], true);
                    assert.equal(resultsArray[6], false);
                });
            });
        });
    });

});
