var scheduler = require('..');
var expect = require('chai').expect;
var moment = require('moment');
var sinon = require('sinon');

describe('@momsfriendlydevco/scheduler', ()=> {

	/**
	* Curry function to return if date A equals date B without millisecond precision
	* @param {Date} a Date to check against
	* @returns {boolean} Boolean true if Date A matches B on the curry product
	*/
	var dateCheck = (a) => {
		return b => {
			var isSame = moment(a).milliseconds(0).isSame(moment(b).milliseconds(0));
			if (!isSame) console.log('Mismatch', {
				check: a.toLocaleString(),
				given: b.toLocaleString(),
			});
			return isSame;
		};
	};

	xit('should trigger callback', (done)=> {
		//var spy = sinon.spy();
		var spy = () => {
			console.log('called');
		};
		var s = new scheduler.Task('in 1 seconds', spy);
		scheduler.start();
		setTimeout(() => {
			//sinon.assert.calledOnce(spy);
			scheduler.pause();
			console.log('done');
			done();
		}, 1500);
	}).timeout(5000);

	it('should parse simple time strings', ()=> {
		var s = new scheduler.Task('12pm');
		expect(s).to.have.deep.property('_timing', ['12pm']);
		expect(s).to.have.property('nextTick')

		expect(
			moment(s.nextTick).milliseconds(0).toDate()
		).to.deep.equal(
			moment().hour(0).add(12, 'hours').minute(0).seconds(0).milliseconds(0).toDate()
		);

		s.dateMidnight = ()=> new Date('2020-01-30T00:00:00');
		s.dateNow = s.dateMidnight;
		s.timing('12pm');
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-01-30T12:00:00')));

		s.timing('every 2m');
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-01-30T00:02:00')));

		s.timing('every 1h');
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-01-30T01:00:00')));

		s.timing('every 1h45m2s');
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-01-30T01:45:02')));

		s.timing('0 1 * * * *');
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-01-30T00:01:00')));

		s.timing('0 0 */3 * * *');
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-01-30T03:00:00')));
	});

	it('should parse array time strings', ()=> {
		var s = new scheduler.Task();
		s.dateMidnight = ()=> new Date('2020-02-01T00:00:00');
		s.timing('10am,2pm,4:36am');
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-02-01T04:36:00')));

		s.dateMidnight = ()=> new Date('2020-02-01T08:00:00');
		s.scheduleNext();
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-02-01T10:00:00')));
	});

	it('should throw when unable to schedule', ()=> {
		expect(()=> new scheduler.Task('blah')).to.throw;
	});

	it('should complain with weird schedule strings (when configured to)', ()=> {
		scheduler.settings.throwUnknown = true;
		expect(()=> new scheduler.Task('1am,blah,2pm')).to.throw;
	});

	it('should add timeBias setting', ()=> {
		scheduler.settings.timeBias = 1 * 1000 * 60 * 60; // 1h
		var s = new scheduler.Task('12pm');
		s.dateMidnight = ()=> new Date('2020-02-01T00:00:00');
		s.scheduleNext();
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-02-01T13:00:00')));
	});

});
