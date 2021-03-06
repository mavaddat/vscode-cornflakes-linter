import { Task } from "vscode";

export interface ITask<T> {
	(): T; /** Generic function with no args returns data of type T as interface, e.g.,
	let blah: ITask<number>=()=>17; 
	console.log(blah()+1); //writes 18
	**/
}
/**
 * A helper to prevent accumulation of sequential async tasks.
 *
 * Imagine a mail man with the sole task of delivering letters. As soon as
 * a letter submitted for delivery, he drives to the destination, delivers it
 * and returns to his base. Imagine that during the trip, N more letters were submitted.
 * When the mail man returns, he picks those N letters and delivers them all in a
 * single trip. Even though N+1 submissions occurred, only 2 deliveries were made.
 *
 * The throttler implements this via the queue() method, by providing it a task
 * factory. Following the example:
 *
 * 		var throttler = new Throttler();
 * 		var letters = [];
 *
 * 		function letterReceived(l) {
 * 			letters.push(l);
 * 			throttler.queue(() => { return makeTheTrip(); });
 * 		}
 */
export class Throttler<T> {

	private activePromise: Promise<T>;
	private queuedPromise: Promise<T>;
	private queuedPromiseFactory: ITask<Promise<T>>;

	constructor() {
		this.activePromise =new Promise<T>((resolve, reject) => {throw new Error("default value");
		 }); 
		this.queuedPromise = new Promise<T>((resolve, reject) => {throw new Error("default value");});
		this.queuedPromiseFactory = ()=>(new Promise<T>((resolve, reject) => {throw new Error("default value");}));
	}

	public queue(promiseFactory: ITask<Promise<T>>): Promise<T> {
		if (this.activePromise) {
			this.queuedPromiseFactory = promiseFactory;

			if (!this.queuedPromise) {
				var onComplete = () => {
					this.queuedPromise = new Promise<T>((resolve, reject) => {});

					var result = this.queue(this.queuedPromiseFactory);
					this.queuedPromiseFactory = ()=>(new Promise<T>((resolve, reject) => {}));

					return result;
				};

				this.queuedPromise = new Promise<T>((resolve, reject) => {
					this.activePromise.then(onComplete, onComplete).then(resolve);
				});
			}

			return new Promise<T>((resolve, reject) => {
				this.queuedPromise.then(resolve, reject);
			});
		}

		this.activePromise = promiseFactory();

		return new Promise<T>((resolve, reject) => {
			this.activePromise.then((result: T) => {
				this.activePromise = new Promise<T>((resolve, reject) => {});
				resolve(result);
			}, (err: any) => {
				this.activePromise = new Promise<T>((resolve, reject) => {});
				reject(err);
			});
		});
	}
}

/**
 * A helper to delay execution of a task that is being requested often.
 *
 * Following the throttler, now imagine the mail man wants to optimize the number of
 * trips proactively. The trip itself can be long, so the he decides not to make the trip
 * as soon as a letter is submitted. Instead he waits a while, in case more
 * letters are submitted. After said waiting period, if no letters were submitted, he
 * decides to make the trip. Imagine that N more letters were submitted after the first
 * one, all within a short period of time between each other. Even though N+1
 * submissions occurred, only 1 delivery was made.
 *
 * The delayer offers this behavior via the trigger() method, into which both the task
 * to be executed and the waiting period (delay) must be passed in as arguments. Following
 * the example:
 *
 * 		var delayer = new Delayer(WAITING_PERIOD);
 * 		var letters = [];
 *
 * 		function letterReceived(l) {
 * 			letters.push(l);
 * 			delayer.trigger(() => { return makeTheTrip(); });
 * 		}
 */
export class Delayer<T> {

	public defaultDelay: number;
	private timeout: NodeJS.Timeout;
	private completionPromise: Promise<T>;
	private onResolve: (value: T | Thenable<T>) => void;
	private task: ITask<T>;

	constructor(defaultDelay: number) {
		this.defaultDelay = defaultDelay;
		this.timeout = setTimeout(()=>{},0);
		this.completionPromise = new Promise<T>((resolve, reject) => {});
		this.onResolve = (value: T | Thenable<T>) => {};
		this.task = ()=>Object();
	}

	public trigger(task: ITask<T>, delay: number = this.defaultDelay): Promise<T> {
		this.task = task;
		this.cancelTimeout();

		if (!this.completionPromise) {
			this.completionPromise = new Promise<T>((resolve, reject) => {
				this.onResolve = resolve;
			}).then(() => {
				this.completionPromise = new Promise<T>((resolve, reject) => {});
				this.onResolve = (value: T | Thenable<T>) => {};

				var result = this.task();
				this.task = ()=>Object();

				return result;
			});
		}

		this.timeout = setTimeout(() => {
			this.timeout = setTimeout(()=>{},0);
			this.onResolve(new Promise<T>((resolve, reject) => {}));
		}, delay);

		return this.completionPromise;
	}

	public isTriggered(): boolean {
		return this.timeout !== null;
	}

	public cancel(): void {
		this.cancelTimeout();

		if (this.completionPromise) {
			this.completionPromise = new Promise<T>((resolve, reject) => {});
		}
	}

	private cancelTimeout(): void {
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = setTimeout(()=>{},0);;
		}
	}
}

/**
 * A helper to delay execution of a task that is being requested often, while
 * preventing accumulation of consecutive executions, while the task runs.
 *
 * Simply combine the two mail man strategies from the Throttler and Delayer
 * helpers, for an analogy.
 */
export class ThrottledDelayer<T> extends Delayer<Promise<T>> {

	private throttler: Throttler<T>;

	constructor(defaultDelay: number) {
		super(defaultDelay);

		this.throttler = new Throttler();
	}

	public trigger(promiseFactory: ITask<Promise<T>>, delay?: number): Promise<Promise<T>> {
		return super.trigger(() => this.throttler.queue(promiseFactory), delay);
	}
}