var mlog = require('mocha-logger');
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

	after('stop scheduler', ()=> scheduler.stop());

	it('should parse simple time strings', ()=> {
		var s = scheduler.Task('12pm');
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

		s.timing('*/1 * * * * *');
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-01-30T00:00:01')));

		// Support cron strings without seconds
		s.timing('*/1 * * * *');
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-01-30T00:01:00')));
	});

	it('should parse array time strings', ()=> {
		var s = scheduler.Task();
		s.dateMidnight = ()=> new Date('2020-02-01T00:00:00');
		s.timing('10am,2pm,4:36am');
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-02-01T04:36:00')));

		s.dateMidnight = ()=> new Date('2020-02-01T08:00:00');
		s.scheduleNext();
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-02-01T10:00:00')));
	});

	it('should throw when unable to schedule', ()=> {
		expect(()=> scheduler.Task('blah')).to.throw;
	});

	it('should complain with weird schedule strings (when configured to)', ()=> {
		scheduler.settings.throwUnknown = true;
		expect(()=> scheduler.Task('1am,blah,2pm')).to.throw;
	});

	it('should add timeBias setting', ()=> {
		scheduler.settings.timeBias = 1 * 1000 * 60 * 60; // 1h
		var s = scheduler.Task('12pm');
		s.dateMidnight = ()=> new Date('2020-02-01T00:00:00');
		s.scheduleNext();
		expect(s.nextTick).to.satisfy(dateCheck(new Date('2020-02-01T13:00:00')));
		scheduler.settings.timeBias = 0;
	});

	it('should handle repetitive tasks that resolve correctly', function(done) {
		this.timeout(6 * 1000); //= 6s

		var responses = 0;
		var task = scheduler.Task()
			.timing('every 1s')
			.task(()=> {
				mlog.log('Task pulse', ++responses);
				return true;
			})

		scheduler.start();

		setTimeout(()=> { // Wait ~3s and remove task
			task.stop(); // Release task
		}, 3500);

		setTimeout(()=> { // Wait ~5s for the above scenario to play out
			expect(responses).to.equal(3);
			done();
		}, 5000);
	});

	it.skip('should handle repetitive tasks that resolve intermittently', function(done) {
		this.timeout(6 * 1000); //= 6s

		var responses = {ticks: 0, ok: 0, notok: 0};
		var task = scheduler.Task('every 1s')
			.task(()=> {
				if ((++responses.ticks % 2) == 0) {
					mlog.log('Task OK', responses.ticks);
					responses.ok++;
					return true;
				} else {
					mlog.log('Task THROW', responses.ticks);
					responses.notok++;
					throw new Error('Intentional task fail');
				}
			})

		scheduler.start();

		setTimeout(()=> { // Wait ~4s and remove task
			task.stop(); // Release task
		}, 4500);

		setTimeout(()=> { // Wait ~6s for the above scenario to play out
			expect(responses).to.deep.equal({ok: 2, notok: 2});
			done();
		}, 6000);
	});

});
