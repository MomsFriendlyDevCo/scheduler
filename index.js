var _ = require('lodash');
var debug = require('debug')('scheduler');
var cronParser = require('cron-parser');
var eventer = require('@momsfriendlydevco/eventer');
var parseTime = require('fix-time');
var timeString = require('timestring');

var Scheduler = eventer.extend({});

Scheduler.settings = {
	autoStart: true,
	tickTimeout: 1 * 1000, //= 1s
	timeBias: 0, //= 0ms
	throwUnknown: true,
};
debug('Booting with tickTimeout of', Scheduler.tickTimeout);


/**
* Perform one tick cycle, each subscriber should check whether it should operate and return a promise if it is working
* @returns {Promise} A promise when the tick cycle completes
*/
Scheduler.tick = ()=> {
	clearTimeout(Scheduler.timer);
	var tickDate = (new Date).toISOString();
	Promise.resolve()
		.then(()=> debug('Tick!', tickDate))
		.then(()=> Scheduler.emit('tick'))
		.then(()=> debug('Tick complete'))
		.then(()=> Scheduler.timer = setTimeout(Scheduler.tick, Scheduler.settings.tickTimeout));
	return Scheduler;
};


/**
* Start the scheduler
* Scheduler will emit tick events which subscribers can listen to and respond with a promise
* Automatically executed if Scheduler.autoStart is truthy
* @returns {Scheduler}
*/
Scheduler.start = ()=> {
	debug('Scheduler started');
	if (Scheduler.timer) return Scheduler;
	// FIXME: Using `setInterval` could prevent 1ms of lag? `tick` redefining timer may introduce gradual creep.
	// scheduler Tick! 2020-03-12T01:03:51.383Z +1s
	// scheduler Tick! 2020-03-12T01:03:52.384Z +1s
	// scheduler Tick! 2020-03-12T01:03:53.385Z +1s
	Scheduler.timer = setTimeout(Scheduler.tick, Scheduler.settings.tickTimeout);
	return Scheduler;
};


/**
* Stop / Pause the scheduler
* This effecitvely kills the scheduling of all tasks until the next Scheduler.start()
* @returns {Scheduler}
*/
Scheduler.pause = ()=> {
	if (!Scheduler.timer) return Scheduler;
	debug('Scheduler paused');
	clearTimeout(Scheduler.timer);
	delete Scheduler.timer;
	return Scheduler;
};




/**
* Scheduler Task instance
* @param {string} [timing] Optional initial timing, automatically calls `Task.timing(timeing)`
*/
Scheduler.Task = function(timing, cb) {
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
	* Set the parsable time string for when task execution should be scheduled
	* This function automatically reschedules the next execution via `scheduleNext()`
	* @param {array|string} timing The parsable schedule, if the value is a string it is evaluated as a CSV
	* @returns {Task} This chainable instance
	* @see scheduleNext()
	*/
	ct.timing = timing => {
		ct._timing = _.isArray(timing) ? timing : timing.split(/\s*,\s*/);
		ct.scheduleNext();
		return ct;
	};


	/**
	* Convenience function to override the executable task
	* Tasks are expected to return a Promise
	* @param {function} task The task to set
	* @returns {Task} This chainable instance
	*/
	ct.task = task => {
		if (!task) throw new Error('No task payload provided');
		ct._task = task;
		Scheduler.on('tick', () => {
			if (Date.now() >= ct.nextTick) {
				ct.scheduleNext();
				return ct._task.call(ct);
			}
		});
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
				if (Scheduler.settings.throwUnknown && !v)
					throw `Unsupported time string "${ct._timing[i]}" in scheduler expression "${ct._timing.join(', ')}"`;
				debug('Parse time string', ct._timing[i], '~=', v ? v.toLocaleString() : '(INVALID)');
				return v;
			})
			.filter(v => v >= now) // Exclude all dates that happened in the past
			.reduce((t, v) => !t || v < t ? v : t, null) // Find minimum time
		debug('Task scheduled for', ct.nextTick);

		if (!ct.nextTick) throw new Error(`Cannot determine next scheduled tick from schedule "${ct._timing.join(', ')}"`);

		if (Scheduler.settings.timeBias != 0) // Add bias time to nextTick
			ct.nextTick = new Date(ct.nextTick.getTime() + Scheduler.settings.timeBias);

		return ct;
	};

	if (timing) ct.timing(timing);
	if (cb) ct.task(cb);

	return ct;
};

module.exports = Scheduler;
