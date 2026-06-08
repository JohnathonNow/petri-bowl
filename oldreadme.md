NOTE: This project is in the ideation phase and currently there's no code here.

Basically, the general idea is to make a game where players draw simple neural networks
using the inputs below for simple amoeba to follow. Each amoeba has breedable traits.
The amoeba are then trained to play a simplified version of American Football.

Game is played on a 256x128 grid
Game is 60 minutes
Players can occupy tenths of a grid unit

Stats:
	Speed - number of tenths a player can move per turn [default 1]
	Shake - when grabbed, the liklihood they can shake off a player of equal weight per turn [default 0.05]
	Catch - odds a player catches a perfect pass [default 0.95]
	Throw - odds a player throws a ball perfectly straight [default 0.975]
	Block - odds a player blocks a perfect pass they are in line of [default 0.1]
	Int - odds a player intercepts a perfect pass they are in line of [default 0.01]
	Weight - effects how slowed down a dragged player is, +200 [default 75]
	Arm - average pass distance, normal distribution past this number [default 30]
 	
Player Input:
	Play call number [int]
	Relative positions of every player on the field [array of pairs of int]
		0 is on top of player, 1-4 are literal field units, 5 is within 32 field units, 6 is within 128 field units, 7 is past that
	Position on the field, where x=0 is your own goal line, x=255 is the opposing endzone [pair of int]
	Can ball be thrown, becomes false if ball passes line of scrimmage or is passed forward [bool]	
	
Player Output:
	Direction - direction to move in
	Speed - 0-8 how much the player should move as a fraction of their speed
	Pass - 0-10 which player to pass or hand the ball to (pass is > 1 field unit, forward pass advances the ball in the x direction)
	

Coach Input:
	Score delta [int]
	Game time in minutes [int]

Coach Output:
	Play call number [int]	


