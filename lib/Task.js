/**
* Scheduler task instance
* @param {string} [timing] Optional initial timing, automatically calls `Task.timing(timeing)`
* @param {function} [cb] Callback function to run
* @param {Scheduler} [scheduler] Alternative scheduler to bind to, if omitted the global scope scheduler is assumed
* @returns {Task} Instanciated task instance
*/

var debug = require('debug')('scheduler:task');
var cronParser = require('cron-parser');
var parseTime = require('fix-time');
var timeString = require('timestring');

module.exports = function(timing, cb, scheduler) {
	var ct = this;


	/**
	* Fix-time compatible input strings which determines the next task execution
	* The array is evalulated with the lowest next match used as the nextTick value
	* @type {array<string>}
	*/
	ct._timing;


	/**
	* The callback to execute when the task fires
	* @type {function}
	*/
	ct._task = ()=> { throw new Error('Task executed with no payload') };


	/**
	* Function to catch errors thrown from the task callback
	* @type {function}
	*/
	ct._taskCatch = e => { console.warn('TASK FAILED:', e.toString()) };


	/**
	* Parent scheduler
	* @type {Scheduler}
	*/
	ct._Scheduler = scheduler;


	/**
	* Next execution of this task
	* @type {Date}
	*/
	ct.nextTick;


	/**
	* Handle to the timer used to check the task execution
	* This does not equate to the worker, but the `Task.check()` function
	* @type {function}
	*/
	ct.check;


	/**
	* Event subscription handler
	* Will only execute if the task schedule is valid
	* @returns {Task} This chainable instance
	*
	*/
	ct.tick = ()=> {
		var now = new Date();
		if (now >= ct.nextTick) { // Run the task callback
			return Promise.resolve()
				.then(()=> ct._task.call(ct))
				.catch(e => ct._taskCatch.call(ct, e))
				.finally(ct.scheduleNext);
		}
	};


	/**
	* Set the parsable time string for when task execution should be scheduled
	* This function automatically reschedules the next execution via `scheduleNext()`
	* @param {array|string} timing The parsable schedule, if the value is a string it is evaluated as a CSV
	* @returns {Task} This chainable instance
	* @see scheduleNext()
	*/
	ct.timing = timing => {
		ct._timing = Array.isArray(timing) ? timing : timing.split(/\s*,\s*/);
		ct.scheduleNext();
		return ct;
	};


	/**
	* Convenience function to override the executable task
	* Tasks are expected to return a Promise
	* @param {function} cb The task to set
	* @returns {Task} This chainable instance
	*/
	ct.task = cb => {
		ct._Scheduler.off('tick', ct.tick);
		if (!cb) throw new Error('No task payload provided');
		ct._task = cb;
		debug('Bind task CB', cb);
		ct._Scheduler.on('tick', ct.tick);
		return ct;
	};


	/**
	* Set the catch handler when a task fails
	* @param {function} cb Callback called as `(err)` on fail
	* @returns {Task} This chainable instance
	*/
	ct.taskCatch = cb => {
		ct._taskCatch = cb;
		return ct;
	};


	/**
	* Resubscribe to tick handler
	* @returns {Task} This chainable instance
	*/
	ct.start = ()=> {
		ct._Scheduler.on('tick', ct.tick);
		return ct;
	};


	/**
	* Unsubscribe from tick handler, releasing the current task
	* @returns {Task} This chainable instance
	*/
	ct.stop = ()=> {
		ct._Scheduler.off('tick', ct.tick);
		return ct;
	};


	/**
	* Bind to a specific scheduler
	* @param {Scheduler} scheduler The scheduler to bind to
	* @returns {Task}
	*/
	ct.attachTo = scheduler => {
		scheduler.attach(ct);
		return ct;
	};


	/**
	* How to retrieve the current days absolute midnight time
	* This is mainly for test mocking
	* @returns {Date} The current date/time
	*/
	ct.dateMidnight = ()=> (new Date()).setHours(0, 0, 0, 0);


	/**
	* How to retrieve the current days absolute time
	* This is mainly for test mocking
	* @returns {Date} The current date/time
	*/
	ct.dateNow = ()=> new Date();


	/**
	* Test utility to force the value of the ct.dateMidnight() function
	* @param {Date}


	/**
	* Calculate the next scheduled task, automatically called if `timing()` is invoked
	* Any timing changes automatically call this function, so its unlikely this needs to be invoked manually
	* @returns {Task} This chainable instance
	* @see timing()
	*/
	ct.scheduleNext = ()=> {
		var now = ct.dateMidnight();
		ct.nextTick = ct._timing
			.map(v => {
				if (/^\s*.+\s+.+\s+.+\s+.+\s+.+\s*.+\s*$/.test(v)) {
					var parsed = cronParser.parseExpression(v, {
						currentDate: ct.dateNow(),
						iterator: false,
					});
					return parsed.next().toDate();
				// Support for cron strings without seconds
				} else if (/^\s*.+\s+.+\s+.+\s+.+\s*.+\s*$/.test(v)) {
					var parsed = cronParser.parseExpression('0 ' + v, {
						currentDate: ct.dateNow(),
						iterator: false,
					});
					return parsed.next().toDate();
				} else if (v.startsWith('every ')) {
					var offset = timeString(v.substr(6), 'ms');
					if (!offset) return;
					return new Date(ct.dateNow().getTime() + offset);
				} else {
					return parseTime(v, {now: ct.dateMidnight()})
				}
			})
			// .filter(v => v) // Remove blanks
			.map((v, i) => {
				if (ct._Scheduler.settings.throwUnknown && !v)
					throw `Unsupported time string "${ct._timing[i]}" in scheduler expression "${ct._timing.join(', ')}"`;
				debug('Parse time string', ct._timing[i], '~=', v ? v.toLocaleString() : '(INVALID)');
				return v;
			})
			.filter(v => v >= now) // Exclude all dates that happened in the past
			.reduce((t, v) => !t || v < t ? v : t, null) // Find minimum time

		if (!ct.nextTick) throw new Error(`Cannot determine next scheduled tick from schedule "${ct._timing.join(', ')}"`);

		// Add bias time to nextTick
		if (ct._Scheduler.settings.timeBias != 0) {
			ct.nextTick = new Date(ct.nextTick.getTime() + ct._Scheduler.settings.timeBias);
			debug('Added timeBias to nextTick', ct._Scheduler.settings.timeBias);
		}
		debug('Task scheduled for', ct.nextTick);

		return ct;
	};

	if (timing) ct.timing(timing);
	if (cb) ct.task(cb);

	return ct;
}
