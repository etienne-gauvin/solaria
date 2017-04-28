enum Time {

	Second = 1000,

	Minute = Time.Second * 60,

	Hour = Time.Minute * 60,
	
	Day = Time.Hour * 24,

	Week = Time.Day * 7

}

class DateUtils {

	public readonly Now: number
	
	public atLeastAgedOf(date: Date|number, duration: number): boolean {

		return +new Date - +date >= duration

	}

	public wasAtLeastLastWeek(date: Date|number) {

		

	}

	private constructor() {}

	public static readonly instance = new DateUtils

}

const instance = DateUtils.instance

export { instance as DateUtils, Time }