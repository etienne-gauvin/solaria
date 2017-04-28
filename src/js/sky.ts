import game from './game'
import { Time } from './date-utils'
import { Color } from 'three'

export default class Sky {

	// Color of the sky at a certain time in the day
	private colors: Array<{ from: number, to: number, color: Color }> = [
		{ from:  0, to:  5, color: new Color('#1B0C3E') },
		{ from:  9, to: 18, color: new Color('#52C4F4') },
		{ from: 22, to: 24, color: new Color('#1B0C3E') }
	]

	private lastUpdate: number = 0

	public readonly color: Color = new Color('hsl(0, 60%, 50%)')

	public testDateAdjustment: number = 0

	private date: number

	constructor() {

		this.date = +new Date

		game.datgui.add(
			this, 'testDateAdjustment',
			- 6 * Time.Hour,
			+ 6 * Time.Hour)
			.step(Time.Minute)
			.name('Sky Test Time')

	}

	public update(event) {

		const nowDate = new Date

		// Update every minute 
		if (+nowDate - this.lastUpdate > 200) {
			
			this.lastUpdate = +nowDate

			const now = +nowDate + this.testDateAdjustment

			nowDate.setTime(now)

			const hours = nowDate.getHours()

			for (let r in this.colors) {

				const range = this.colors[r]

				// Apply color
				if (hours >= range.from && hours < range.to) {

					this.color.copy(range.color)

					break

				}

				else if (hours < range.from) {

					// Previous range
					const previousR = (+r > 0) ? +r - 1 : this.colors.length - 1
					const previousRange = this.colors[previousR]
					
					// Previous hour
					const previousHour = (new Date(now)).setHours(previousRange.to, 0, 0, 0)

					// Next hour
					const nextHour = (new Date(now)).setHours(range.to, 0, 0, 0)

					// Alpha
					const alpha = (nextHour - now) / (nextHour - previousHour)

					// Interpolation
					this.color
						.copy(range.color)
						.lerp(previousRange.color, alpha)

					break

				}

			}

		}

	}

}