Game is played on a 300x160 grid
Game is 60 minutes
Players can occupy tenths of a grid unit

Stats:
	Speed - number of tenths a player can move per turn [default 1]
	Shake - when grabbed, the liklihood they can shake off a player of equal weight per turn [default 0.05]
	Catch - odds a player catches a perfect pass [default 0.95]
	Throw - odds a player throws a ball perfectly straight [default 0.97]
	Block - odds a player blocks a perfect pass they are in line of [default 0.1]
	Weight - effects how slowed down a dragged player is [default 275]
	Arm - average pass distance, normal distribution past this number [default 30]
	#Agile - Number of turns to spend changing direction [default 3]
 
Input:
	Score difference
	Time remaining in minutes
	Relative positions of every player on the field in buckets of 10
	Position on the field, where x=0 is your own goal line, x=300 is the opposing endzone	
