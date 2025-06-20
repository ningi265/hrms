// services/locationService.js - FIXED VERSION for testing with pending drivers

const User = require('../../models/user');
const cron = require('node-cron');

class LocationService {
  constructor(io = null) {
    this.io = io;
    this.isRunning = false;
    this.updateInterval = null;
    this.lastUpdateTime = null;
  }

  start(intervalMinutes = 2) {
    if (this.isRunning) {
      console.log('Location service is already running');
      return;
    }

    console.log(`Starting location service with ${intervalMinutes} minute intervals`);
    this.isRunning = true;

    const cronPattern = `*/${intervalMinutes} * * * *`;
    
    this.updateInterval = cron.schedule(cronPattern, async () => {
      await this.fetchAllDriverLocations();
    }, {
      scheduled: false
    });

    this.updateInterval.start();
    
    // Run initial fetch
    this.fetchAllDriverLocations();

    console.log('Location service started successfully');
  }

  stop() {
    if (!this.isRunning) {
      console.log('Location service is not running');
      return;
    }

    if (this.updateInterval) {
      this.updateInterval.stop();
      this.updateInterval = null;
    }

    this.isRunning = false;
    console.log('Location service stopped');
  }

  async fetchAllDriverLocations() {
    try {
      console.log('Fetching live locations for all active drivers...');
      
      // FIXED: Include pending drivers and don't filter by lastLoginAt for testing
      const activeDrivers = await User.find({
        role: 'Driver',
        status: { $in: ['active', 'pending'] } // Include pending drivers
      }).select(['firstName', 'lastName', 'employeeId', 'location', 'lastLoginAt']);

      console.log(`Found ${activeDrivers.length} drivers to update`);

      const updatePromises = [];
      let successCount = 0;
      let errorCount = 0;

      for (const driver of activeDrivers) {
        // FIXED: Update all drivers, not just "online" ones for testing
        updatePromises.push(this.fetchAndUpdateDriverLocation(driver));
      }

      const results = await this.executeBatch(updatePromises, 5);
      
      results.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      });

      this.lastUpdateTime = new Date();

      console.log(`Location update completed: ${successCount} successful, ${errorCount} failed`);

      if (this.io) {
        this.io.emit('location-service-update', {
          timestamp: this.lastUpdateTime,
          driversUpdated: successCount,
          driversTotal: activeDrivers.length,
          errors: errorCount
        });
      }

      return {
        success: true,
        driversUpdated: successCount,
        driversTotal: activeDrivers.length,
        errors: errorCount
      };

    } catch (error) {
      console.error('Error in bulk location fetch:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async fetchAndUpdateDriverLocation(driver) {
    try {
      console.log(`Fetching location for driver: ${driver.firstName} ${driver.lastName} (${driver.employeeId})`);
      
      const liveLocation = await this.simulateGPSFetch(driver);
      
      if (liveLocation) {
        // Update location in database
        await driver.updateLastKnownLocation(
          liveLocation.latitude,
          liveLocation.longitude,
          liveLocation.accuracy,
          'gps',
          {
            speed: liveLocation.speed,
            heading: liveLocation.heading,
            batteryLevel: liveLocation.batteryLevel,
            signalStrength: liveLocation.signalStrength
          }
        );

        console.log(`✅ Updated location for ${driver.employeeId}: ${liveLocation.latitude}, ${liveLocation.longitude}`);

        // Emit real-time update
        if (this.io) {
          this.io.emit('driver-location-update', {
            driverId: driver.employeeId,
            driverName: `${driver.firstName} ${driver.lastName}`,
            location: { 
              latitude: liveLocation.latitude, 
              longitude: liveLocation.longitude 
            },
            accuracy: liveLocation.accuracy,
            speed: liveLocation.speed,
            heading: liveLocation.heading,
            batteryLevel: liveLocation.batteryLevel,
            timestamp: new Date(),
            source: 'gps'
          });
        }

        return {
          success: true,
          driverId: driver.employeeId,
          location: liveLocation
        };
      } else {
        console.log(`❌ No GPS data available for ${driver.employeeId}`);
        return {
          success: false,
          driverId: driver.employeeId,
          error: 'No GPS data available'
        };
      }
    } catch (error) {
      console.error(`❌ Error fetching location for driver ${driver.employeeId}:`, error);
      return {
        success: false,
        driverId: driver.employeeId,
        error: error.message
      };
    }
  }

  async simulateGPSFetch(driver) {
    try {
      // Get existing location or use default Malawi coordinates
      const baseLocation = driver.location?.lastKnownLocation || {
        latitude: -13.2543,  // Lilongwe center
        longitude: 34.3015
      };

      // ENHANCED: More realistic simulation with proper coordinates
      const latVariation = (Math.random() - 0.5) * 0.008; // ~800m variation
      const lngVariation = (Math.random() - 0.5) * 0.008;
      
      const newLocation = {
        latitude: parseFloat((baseLocation.latitude + latVariation).toFixed(6)),
        longitude: parseFloat((baseLocation.longitude + lngVariation).toFixed(6)),
        accuracy: Math.floor(Math.random() * 15) + 5, // 5-20 meters
        speed: this.generateRealisticSpeed(),
        heading: Math.floor(Math.random() * 360),
        batteryLevel: this.generateBatteryLevel(driver),
        signalStrength: Math.floor(Math.random() * 30) + 70, // 70-100%
        timestamp: new Date()
      };

      // Ensure coordinates stay within Malawi bounds
      if (newLocation.latitude < -17.129 || newLocation.latitude > -9.368 ||
          newLocation.longitude < 32.670 || newLocation.longitude > 35.918) {
        // Reset to center if outside bounds
        newLocation.latitude = -13.2543;
        newLocation.longitude = 34.3015;
      }

      // Simulate occasional network failures (reduced to 2% for testing)
      if (Math.random() < 0.02) {
        console.log(`Network failure simulated for driver ${driver.employeeId}`);
        return null;
      }

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500));

      return newLocation;
    } catch (error) {
      console.error('Error simulating GPS fetch:', error);
      return null;
    }
  }

  generateRealisticSpeed() {
    const hour = new Date().getHours();
    
    if (hour >= 22 || hour <= 5) {
      // Night time - mostly stationary or slow
      return Math.random() < 0.7 ? 0 : Math.floor(Math.random() * 30);
    } else if (hour >= 6 && hour <= 9) {
      // Morning rush - moderate to high speeds
      return Math.floor(Math.random() * 60) + 20;
    } else if (hour >= 17 && hour <= 19) {
      // Evening rush - moderate to high speeds
      return Math.floor(Math.random() * 50) + 25;
    } else {
      // Normal working hours - varied speeds
      return Math.floor(Math.random() * 40) + 10;
    }
  }

  generateBatteryLevel(driver) {
    const lastBattery = driver.location?.lastKnownLocation?.batteryLevel;
    
    if (!lastBattery) {
      return Math.floor(Math.random() * 50) + 50; // 50-100% for new devices
    }

    // Gradual battery decrease
    const decrease = Math.floor(Math.random() * 2); // 0-1% decrease
    const newBattery = Math.max(10, lastBattery - decrease); // Don't go below 10%
    
    return newBattery;
  }

  async executeBatch(promises, batchSize) {
    const results = [];
    
    for (let i = 0; i < promises.length; i += batchSize) {
      const batch = promises.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      // Small delay between batches
      if (i + batchSize < promises.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  // REMOVED: isDriverOnline check - now updating all drivers for testing

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdateTime: this.lastUpdateTime,
      updateInterval: this.updateInterval ? 'Active' : 'Inactive'
    };
  }

  async triggerUpdate() {
    if (!this.isRunning) {
      throw new Error('Location service is not running');
    }
    
    return await this.fetchAllDriverLocations();
  }

  async updateDriverLocation(driverId) {
    try {
      const driver = await User.findOne({ 
        $or: [{ employeeId: driverId }, { _id: driverId }],
        role: 'Driver' 
      }).select(['firstName', 'lastName', 'employeeId', 'location', 'lastLoginAt']);

      if (!driver) {
        throw new Error('Driver not found');
      }

      return await this.fetchAndUpdateDriverLocation(driver);
    } catch (error) {
      console.error(`Error updating location for driver ${driverId}:`, error);
      throw error;
    }
  }
}

module.exports = LocationService;