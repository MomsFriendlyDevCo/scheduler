/**
* Main scheduler module
* Serves as a multiplexor for individual tasks
*/

var debug = require('debug')('scheduler');
var eventer = require('@momsfriendlydevco/eventer');
var Scheduler = eventer.extend({});
var Task = require('./Task');

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
* @param {function} [cb] Callback function to run
* @param {Scheduler} [scheduler] Alternative scheduler to bind to, if omitted the global scope scheduler is assumed
* @returns {Task} Instanciated task instance
*/
Scheduler.Task = (timing, cb, scheduler) => {
	return new Task(timing, cb, scheduler || Scheduler);
};

module.exports = Scheduler;
