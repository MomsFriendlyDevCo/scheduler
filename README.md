@MomsFriendlyDevCo/Scheduler
============================
Generic Cron-like scheduler for tasks that should execute periodically.

This module is intended as a low-level scheduler for [@MomsFriendlyDevCo/Agents](https://github.com/MomsFriendlyDevCo/agents).


Scheduled times
---------------
The following scheduled times are supported:

* `* * * * *` (i.e. six cron-timings) - Parsed by [cron-parser](https://github.com/harrisiirak/cron-parser)
* `every *` (reoccuring intervals) - Parsed by [timestring](https://github.com/mike182uk/timestring)
* `*` (everything else) - Parsed by [fix-time](https://github.com/cefn/fix-time)


Debugging
=========
This module uses the [debug NPM module](https://github.com/visionmedia/debug) for debugging. To enable set the environment variable to `DEBUG=scheduler` or `DEBUG=scheduler*` for detail.

For example:

```
DEBUG=scheduler mocha
```


API
===

Scheduler.settings
------------------
Global settings for the scheduler.

Available settings:

| Setting        | Type      | Default      | Description                                                                                    |
|----------------|-----------|--------------|------------------------------------------------------------------------------------------------|
| `autoStart`    | `boolean` | `true`       | Automatically call `Scheduler.start()` when initialized                                        |
| `tickTimeout`  | `number`  | `1000` (~1s) | The precision of when to check the scheduled task queue                                        |
| `timeBias`     | `number`  | `0`          | What offset (in milliseconds) to add to each timing                                            |
| `throwUnknown` | `boolean` | `true`       | Complain about unknown time sequences within timings, single unknown timings will always throw |


**Notes:**

* `timeBias` is intended to be used on a server with multiple instance profiles (i.e. each server could potentially execute similar processes). Setting it to a random number generator would ensure that not all tasks are executed within the same tick


Scheduler.tick()
----------------
Function called on each "tick".
When called this function cancels the timing of the next tick.
This function returns a promise which resolves when all queued tasks have completed.


Scheduler.start()
-----------------
Resume / execute the scheduler and begin checking for queued tasks on each `Scheduler.settings.tickTimeout`.
Returns the chainable Scheduler instance.


Scheduler.stop() / Scheduler.pause()
------------------------------------
Stops the scheduler, which will not check for future tick items.
Returns the chainable Scheduler instance.


Scheduler.Task(timing, cb, scheduler)
-------------------------------------
Task instance created within a scheduler.
`timing` is an array of timings or a CSV of timings.
`cb` is an optional callback function which gets attached.
`scheduler` is an optional binding to the parent scheduler.


Task.timing(newTiming)
----------------------
Resets and reschedules the task based on the new timing.
This overrides the timing provided in the constructor.
Returns the chainable Task instance.


Task.task(cb)
-------------
Sets the task to execute as if used in the constructor.
Returns the chainable Task instance.


Task.taskCatch(cb)
------------------
Set the catch handler when a task fails.
Returns the chainable Task instance.


Task.start()
------------
Reschedule a task.
Returns the chainable Task instance.


Task.stop()
-----------
Unschedule a task from its parent Scheduler.
Returns the chainable Task instance.


Task.attachTo(scheduler)
------------------------
Reschedule a task to a new scheduler.
Returns the chainable Task instance.
